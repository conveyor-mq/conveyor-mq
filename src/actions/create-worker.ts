import { map, debounce } from 'lodash';
import PQueue from 'p-queue';
import { RedisConfig, sleep } from '../utils/general';
import { getRetryDelayType } from './handle-task';
import {
  createClient,
  ensureConnected,
  tryIgnore,
  disconnect,
} from '../utils/redis';
import { takeTaskBlocking } from './take-task-blocking';
import { takeTask } from './take-task';
import { processTask } from './process-task';
import { Task } from '../domain/tasks/task';

export const createWorker = async ({
  queue,
  redisConfig,
  stallDuration = 1000,
  handler,
  concurrency = 1,
  getRetryDelay,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
  onHandlerError,
  onIdle,
  idleTimeout = 250,
  onReady,
  autoStart = true,
}: {
  queue: string;
  redisConfig: RedisConfig;
  stallDuration?: number;
  handler: ({ task }: { task: Task }) => any;
  concurrency?: number;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
  onIdle?: () => any;
  idleTimeout?: number;
  onReady?: () => any;
  autoStart?: boolean;
}) => {
  let isPausing = false;
  let isPaused = true;
  let isShuttingDown = false;
  let isShutdown = false;
  const takerQueue = new PQueue({ concurrency, autoStart });
  const workerQueue = new PQueue({ concurrency });

  if (onIdle) workerQueue.on('idle', debounce(onIdle, idleTimeout));

  const [takerClient, workerClient] = await Promise.all([
    createClient({ ...redisConfig, lazy: true }),
    createClient({ ...redisConfig, lazy: true }),
  ]);

  const isActive = () =>
    !isPausing && !isPaused && !isShuttingDown && !isShutdown;

  const checkForAndHandleTask = async ({
    block = true,
  }: {
    block?: boolean;
  }) => {
    try {
      const taskTaker = block ? takeTaskBlocking : takeTask;
      const task = await tryIgnore(
        () =>
          taskTaker({
            queue,
            client: takerClient,
            stallDuration,
          }),
        () => isActive(),
      );
      if (task) {
        await workerQueue.add(async () =>
          tryIgnore(
            () =>
              processTask({
                task,
                queue,
                client: workerClient,
                handler,
                stallDuration,
                getRetryDelay,
                onTaskSuccess,
                onTaskError,
                onTaskFailed,
              }),
            () => isActive(),
          ),
        );
      }
      if (isActive()) {
        takerQueue.add(() => checkForAndHandleTask({ block: !task }));
      }
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      await sleep(1000);
      if (isActive()) {
        takerQueue.add(() => checkForAndHandleTask({ block: true }));
      }
    }
  };

  const pause = async () => {
    if (isShutdown || isShuttingDown) {
      throw new Error('Cannot pause a shutdown worker.');
    }
    isPausing = true;
    takerQueue.pause();
    takerQueue.clear();
    await Promise.all([
      disconnect({ client: takerClient }),
      workerQueue.onIdle(),
      takerQueue.onIdle(),
    ]);
    isPaused = true;
    isPausing = false;
  };

  const start = async () => {
    if (isShuttingDown || isShutdown) {
      throw new Error('Cannot start a shutdown worker.');
    }
    if (isPausing) {
      throw new Error('Cannot start a pausing worker.');
    }
    if (isPaused) {
      takerQueue.start();
      workerQueue.start();
      await Promise.all(
        map([takerClient, workerClient], (client) =>
          ensureConnected({ client }),
        ),
      );
      takerQueue.addAll(
        map(Array.from({ length: concurrency }), () => () =>
          checkForAndHandleTask({ block: true }),
        ),
      );
      isPaused = false;
    }
  };

  const shutdown = async (params?: { terminateProcessingTasks?: boolean }) => {
    if (isShuttingDown || isShutdown) {
      throw new Error('Cannot shutdown an already shutdown worker.');
    }
    if (isPausing) {
      throw new Error('Cannot shutdown a pausing worker.');
    }
    isShuttingDown = true;
    takerQueue.pause();
    takerQueue.clear();
    if (params?.terminateProcessingTasks) {
      workerQueue.pause();
      workerQueue.clear();
    }
    await Promise.all([
      disconnect({ client: takerClient }),
      ...(params?.terminateProcessingTasks
        ? [disconnect({ client: workerClient })]
        : []),
      workerQueue.onIdle(),
      takerQueue.onIdle(),
    ]);
    isShutdown = true;
    isShuttingDown = false;
  };

  if (onReady) onReady();
  if (autoStart) await start();

  return {
    pause,
    start,
    shutdown,
  };
};

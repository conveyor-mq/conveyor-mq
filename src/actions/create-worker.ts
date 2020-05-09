import { map, debounce } from 'lodash';
import PQueue from 'p-queue';
import { RedisConfig, sleep } from '../utils/general';
import { getRetryDelayType } from './handle-task';
import { createClient, ensureConnected } from '../utils/redis';
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
  let isPaused = true;
  let isShutdown = false;
  const takerQueue = new PQueue({ concurrency, autoStart });
  const workerQueue = new PQueue({ concurrency });

  if (onIdle) workerQueue.on('idle', debounce(onIdle, idleTimeout));

  const [takerClient, workerClient] = await Promise.all([
    createClient({ ...redisConfig, lazy: true }),
    createClient({ ...redisConfig, lazy: true }),
  ]);

  const checkForAndHandleTask = async ({
    block = true,
  }: {
    block?: boolean;
  }) => {
    try {
      const taskTaker = block ? takeTaskBlocking : takeTask;
      const task = await taskTaker({
        queue,
        client: takerClient,
        stallDuration,
      });
      if (task) {
        await workerQueue.add(async () =>
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
        );
      }
      takerQueue.add(() => checkForAndHandleTask({ block: !task }));
    } catch (e) {
      if (!isPaused && !isShutdown) {
        if (onHandlerError) onHandlerError(e);
        console.error(e.toString());
        await sleep(1000);
        takerQueue.add(() => checkForAndHandleTask({ block: true }));
      }
    }
  };

  const pause = async () => {
    if (isShutdown) {
      throw new Error('Cannot pause a shutdown worker.');
    }
    isPaused = true;
    takerQueue.pause();
    takerQueue.clear();
    await Promise.all([
      takerClient.disconnect(),
      workerQueue.onIdle(),
      takerQueue.onIdle(),
    ]);
  };

  const start = async () => {
    if (isShutdown) {
      throw new Error('Cannot resume a shutdown worker.');
    }
    if (isPaused) {
      isPaused = false;
      await Promise.all(
        map([takerClient, workerClient], (client) =>
          ensureConnected({ client }),
        ),
      );
      takerQueue.start();
      takerQueue.addAll(
        map(Array.from({ length: concurrency }), () => () =>
          checkForAndHandleTask({ block: true }),
        ),
      );
    }
  };

  const shutdown = async (params?: { force?: boolean }) => {
    if (isShutdown) {
      throw new Error('Cannot shutdown an already shutdown worker.');
    }
    isShutdown = true;
    takerQueue.pause();
    takerQueue.clear();
    if (params?.force) {
      workerQueue.pause();
      workerQueue.clear();
    }
    await Promise.all([
      takerClient.disconnect(),
      ...(params?.force ? [workerClient.disconnect()] : []),
      workerQueue.onIdle(),
      takerQueue.onIdle(),
    ]);
    if (!params?.force) {
      await workerClient.disconnect();
    }
  };

  if (onReady) onReady();
  if (autoStart) await start();

  return {
    pause,
    start,
    shutdown,
  };
};

import { map, debounce, forEach } from 'lodash';
import PQueue from 'p-queue';
import moment from 'moment';
import { RedisConfig, sleep, createWorkerId } from '../utils/general';
import { getRetryDelayType } from './handle-task';
import {
  createClient,
  ensureConnected,
  tryIgnore,
  ensureDisconnected,
  publish,
} from '../utils/redis';
import { takeTaskBlocking } from './take-task-blocking';
import { processTask } from './process-task';
import { Task } from '../domain/tasks/task';
import { getWorkerStartedChannel, getWorkerPausedChannel } from '../utils/keys';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';
import { Worker } from '../domain/workers/worker';

/**
 * Regular description
 *
 */
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

  const worker: Worker = {
    id: createWorkerId(),
    createdAt: moment(),
  };

  const takerQueue = new PQueue({ concurrency, autoStart });
  const workerQueue = new PQueue({ concurrency });

  if (onIdle) workerQueue.on('idle', debounce(onIdle, idleTimeout));

  const [takerClient, workerClient] = await Promise.all([
    createClient({ ...redisConfig, lazy: true }),
    createClient({ ...redisConfig, lazy: true }),
  ]);

  const isActive = () =>
    !isPausing && !isPaused && !isShuttingDown && !isShutdown;

  const takeAndProcessTask = async () => {
    try {
      const task = await tryIgnore(
        () =>
          takeTaskBlocking({
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
        takerQueue.add(takeAndProcessTask);
      }
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      await sleep(1000);
      if (isActive()) {
        takerQueue.add(takeAndProcessTask);
      }
    }
  };

  const pause = async (params?: { killProcessingTasks?: boolean }) => {
    if (isShutdown || isShuttingDown) {
      throw new Error('Cannot pause a shutdown worker.');
    }
    isPausing = true;
    forEach(
      params?.killProcessingTasks ? [takerQueue, workerQueue] : [takerQueue],
      (q) => {
        q.pause();
        q.clear();
      },
    );
    await publish({
      channel: getWorkerPausedChannel({ queue }),
      message: serializeEvent({
        createdAt: moment(),
        type: EventTypes.WorkerPaused,
        worker,
      }),
      client: workerClient,
    });
    await Promise.all([
      ...map(
        params?.killProcessingTasks
          ? [takerClient, workerClient]
          : [takerClient],
        (client) => ensureDisconnected({ client }),
      ),
      ...map([workerQueue, takerQueue], (q) => q.onIdle()),
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
      forEach([workerQueue, takerQueue], (q) => q.start());
      await Promise.all(
        map([takerClient, workerClient], (client) =>
          ensureConnected({ client }),
        ),
      );
      takerQueue.addAll(
        map(Array.from({ length: concurrency }), () => takeAndProcessTask),
      );
      isPaused = false;
      await publish({
        channel: getWorkerStartedChannel({ queue }),
        message: serializeEvent({
          createdAt: moment(),
          type: EventTypes.WorkerStarted,
          worker,
        }),
        client: workerClient,
      });
    }
  };

  const shutdown = async (params?: { killProcessingTasks?: boolean }) => {
    if (isShuttingDown || isShutdown) {
      throw new Error('Cannot shutdown an already shutdown worker.');
    }
    if (isPausing) {
      throw new Error('Cannot shutdown a pausing worker.');
    }
    isShuttingDown = true;
    forEach(
      params?.killProcessingTasks ? [takerQueue, workerQueue] : [takerQueue],
      (q) => {
        q.pause();
        q.clear();
      },
    );
    await publish({
      channel: getWorkerStartedChannel({ queue }),
      message: serializeEvent({
        createdAt: moment(),
        type: EventTypes.WorkerShutdown,
        worker,
      }),
      client: workerClient,
    });
    await Promise.all([
      ...map(
        params?.killProcessingTasks
          ? [takerClient, workerClient]
          : [takerClient],
        (client) => ensureDisconnected({ client }),
      ),
      ...map([workerQueue, takerQueue], (q) => q.onIdle()),
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
    onIdle: () =>
      Promise.all(map([takerQueue, workerQueue], (q) => q.onIdle())),
  };
};

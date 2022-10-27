import debugF from 'debug';
import { Redis } from 'ioredis';
import PQueue from 'p-queue';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import {
  clearIntervalAsync,
  setIntervalAsync,
  SetIntervalAsyncTimer,
} from 'set-interval-async/dynamic';
import { EventType } from '../domain/events/event-type';
import { serializeEvent } from '../domain/events/serialize-event';
import { Task } from '../domain/tasks/task';
import { serializeWorker } from '../domain/worker/serialize-worker';
import { Worker } from '../domain/worker/worker';
import { WorkerInstance } from '../domain/worker/worker-instance';
import { createWorkerId, debounce, sleep } from '../utils/general';
import {
  getWorkerKey,
  getWorkerPausedChannel,
  getWorkerStartedChannel,
} from '../utils/keys';
import {
  createClientAndLoadLuaScripts,
  ensureConnected,
  ensureDisconnected,
  publish,
  RedisConfig,
  set,
  tryIgnore,
} from '../utils/redis';
import { createListener } from './create-listener';
import {
  getQueueRateLimitConfig,
  QueueRateLimitConfig,
} from './get-queue-rate-limit-config';
import {
  getRetryDelayType,
  Handler,
  TaskErrorCb,
  TaskFailedCb,
  TaskSuccessCb,
} from './handle-task';
import { markTaskProcessing } from './mark-task-processing';
import {
  OnAfterTaskError,
  OnAfterTaskFail,
  OnAfterTaskSuccess,
  processTask,
} from './process-task';
import { takeTaskBlocking } from './take-task-blocking';

const debug = debugF('conveyor-mq:worker');

export type OnBeforeTaskProcessing = ({ taskId }: { taskId: string }) => any;
export type OnAfterTaskProcessing = ({ task }: { task: Task }) => any;

export interface WorkerInput {
  queue: string;
  redisConfig: RedisConfig;
  redisClient?: Redis;
  handler: Handler;
  concurrency?: number;
  defaultStallTimeout?: number;
  defaultTaskAcknowledgementInterval?: number;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: TaskSuccessCb;
  onTaskError?: TaskErrorCb;
  onTaskFailed?: TaskFailedCb;
  onHandlerError?: (error: any) => any;
  onIdle?: () => any;
  idleTimeout?: number;
  onReady?: () => any;
  autoStart?: boolean;
  removeOnSuccess?: boolean;
  removeOnFailed?: boolean;
  hooks?: {
    onBeforeTaskProcessing?: OnBeforeTaskProcessing;
    onAfterTaskProcessing?: OnAfterTaskProcessing;
    onAfterTaskSuccess?: OnAfterTaskSuccess;
    onAfterTaskError?: OnAfterTaskError;
    onAfterTaskFail?: OnAfterTaskFail;
  };
}

/**
 * Creates a worker which processes tasks on the queue.
 *
 * @param queue - The name of the queue.
 * @param redisConfig - Redis configuration.
 * @param redisClient - An optional Redis client for the worker to re-use. The client
 * must have lua scripts loaded which can be done by calling loadLuaScripts({ client }).
 * @param handler - A handler function used to process tasks. This should return a promise which
 * resolves to indicate task success, or rejects to indicate task failure.
 * @param concurrency - The max number of tasks a worker can process in parallel. Defaults to 10.
 * @param defaultStallTimeout - The default stall timeout to use when taking a task of the queue
 * if task.stallTimeout is not specified.
 * @param defaultTaskAcknowledgementInterval - The default frequency at which to acknowledge a task
 * whilst it is being processed if task.taskAcknowledgementInterval is not specified.
 * @param getRetryDelay - A function called on task error which should return a delay in ms after
 * which the task will be retried.
 * @param onTaskSuccess - Callback called on task success.
 * @param onTaskError - Callback called on task error.
 * @param onTaskFailed - Callback called on task failure.
 * @param onHandlerError - Callback called on handler error.
 * @param onIdle - Callback called on worker idle (Once all tasks have completed and the queue is empty)
 * @param idleTimeout - A timeout in ms after which the worker should be considered idle.
 * Defaults to 250.
 * @param onReady - Callback called once the worker is ready to start processing tasks.
 * @param autoStart - Controls whether the worker should auto start or not. Defaults to true. Else .start()
 * can be used to start the worker manually.
 * @param removeOnSuccess - Control whether tasks should be removed from the queue on success.
 * Defaults to false.
 * @param removeOnFailed - Control whether tasks should be removed from the queue on fail.
 * Defaults to false.
 * @returns worker
 * - .onReady(): Promise<void> - A function which returns a promise that resolves when the worker is ready.
 * - .pause(): Promise<void> - Pauses the worker from processing tasks.
 * - .start(): Promise<void> - Starts the worker processing tasks.
 * - .shutdown(): Promise<void> - Shuts down the worker and disconnects redis clients.
 * - .onIdle(): Promise<void> - Returns a promise which resolves once the worker is idle.
 */
export const createWorker = ({
  queue,
  redisConfig,
  redisClient,
  handler,
  concurrency = 10,
  defaultStallTimeout = 1000,
  defaultTaskAcknowledgementInterval,
  getRetryDelay,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
  onHandlerError,
  onIdle,
  idleTimeout = 250,
  onReady,
  autoStart = true,
  removeOnSuccess = false,
  removeOnFailed = false,
  hooks,
}: WorkerInput): Worker => {
  debug('Starting');
  let isPausing = false;
  let isPaused = true;
  let isShuttingDown = false;
  let isShutdown = false;
  let upsertInterval: SetIntervalAsyncTimer<any>;
  let rateLimitConfig: QueueRateLimitConfig | undefined;
  let rateLimiter: RateLimiterRedis | undefined;

  const worker: WorkerInstance = {
    id: createWorkerId(),
    createdAt: new Date(),
  };

  debug('Starting promise queues');
  const takerQueue = new PQueue({ concurrency, autoStart });
  const workerQueue = new PQueue({ concurrency });

  if (onIdle) workerQueue.on('idle', debounce(onIdle, idleTimeout));

  debug('Creating clients');
  const takerClient = createClientAndLoadLuaScripts({
    ...redisConfig,
    enableReadyCheck: false,
  });
  const workerClient =
    redisClient || createClientAndLoadLuaScripts(redisConfig);

  const isActive = () =>
    !isPausing && !isPaused && !isShuttingDown && !isShutdown;

  const takeAndProcessTask = async (t?: Task | null) => {
    debug(
      t
        ? `Processing pre-fetched task ${t.id}`
        : `Starting to check for tasks to process`,
    );
    try {
      if (rateLimiter) {
        try {
          await rateLimiter.consume(queue);
        } catch (e: any) {
          if (e.msBeforeNext) {
            await sleep(e.msBeforeNext);
            takerQueue.add(takeAndProcessTask);
            return;
          }
        }
      }
      const task =
        t ||
        (await tryIgnore(
          async () => {
            const taskId = await takeTaskBlocking({
              queue,
              client: takerClient,
            });
            if (!taskId) return null;
            if (hooks?.onBeforeTaskProcessing) {
              await hooks.onBeforeTaskProcessing({ taskId });
            }
            const processingTask = await markTaskProcessing({
              taskId,
              queue,
              stallTimeout: defaultStallTimeout,
              client: workerClient,
            });
            if (hooks?.onAfterTaskProcessing) {
              await hooks.onAfterTaskProcessing({ task: processingTask });
            }
            return processingTask;
          },
          () => isActive(),
        ));
      if (task) {
        debug(`Adding task to worker queue ${task.id}`);
        const nextTask = await workerQueue.add(async () =>
          tryIgnore(
            async () => {
              debug(`Processing task ${task.id}`);
              const nextTaskToHandle = await processTask({
                task,
                queue,
                client: workerClient,
                handler,
                stallTimeout: task.stallTimeout || defaultStallTimeout,
                taskAcknowledgementInterval:
                  task.taskAcknowledgementInterval ||
                  defaultTaskAcknowledgementInterval ||
                  defaultStallTimeout / 2,
                onAcknowledgeTask: ({ task: ackTask }) => {
                  debug(`Acknowledging task ${ackTask}`);
                },
                onAcknowledgedTask: ({ task: ackTask }) => {
                  debug(`Acknowledged task ${ackTask}`);
                },
                getRetryDelay,
                onTaskSuccess,
                onTaskError,
                onTaskFailed,
                removeOnSuccess:
                  task.removeOnSuccess !== undefined
                    ? task.removeOnSuccess
                    : removeOnSuccess,
                removeOnFailed:
                  task.removeOnFailed !== undefined
                    ? task.removeOnFailed
                    : removeOnFailed,
                hooks: {
                  onAfterTaskSuccess: hooks?.onAfterTaskSuccess,
                  onAfterTaskError: hooks?.onAfterTaskError,
                  onAfterTaskFail: hooks?.onAfterTaskFail,
                },
              });
              debug(`Processed task ${task.id}`);
              return nextTaskToHandle;
            },
            () => isActive(),
          ),
        );
        if (isActive()) {
          debug('calling takeAndProcessTask with a next task');
          takerQueue.add(() => takeAndProcessTask(nextTask));
        }
      } else if (isActive()) {
        debug('calling takeAndProcessTask without a next task');
        takerQueue.add(takeAndProcessTask);
      }
    } catch (e) {
      debug('takeAndProcessTask error');
      if (onHandlerError) onHandlerError(e);
      await sleep(1000);
      if (isActive()) {
        takerQueue.add(takeAndProcessTask);
      }
    }
  };

  const upsertWorker = async () => {
    debug('Upserting');
    await set({
      key: getWorkerKey({
        workerId: worker.id,
        queue,
      }),
      client: workerClient,
      value: serializeWorker(worker),
      ttl: 30000,
    });
  };

  const setQueueRateLimit = ({
    points,
    duration,
  }: {
    points: number;
    duration: number;
  }) => {
    rateLimitConfig = { points, duration };
    rateLimiter = new RateLimiterRedis({
      storeClient: workerClient,
      points,
      duration,
      keyPrefix: queue,
      inmemoryBlockOnConsumed: points + 1,
    });
  };

  const clearQueueRateLimit = () => {
    rateLimitConfig = undefined;
    rateLimiter = undefined;
  };

  const setupListener = async () => {
    const listener = createListener({
      queue,
      redisConfig,
      events: [EventType.QueueRateLimitUpdated],
    });
    await listener.onReady();
    listener.on(EventType.QueueRateLimitUpdated, ({ event }) => {
      if (event.data?.rateLimitConfig) {
        setQueueRateLimit(event.data.rateLimitConfig);
      } else {
        clearQueueRateLimit();
      }
    });
  };

  const pause = async ({
    killProcessingTasks,
  }: {
    killProcessingTasks?: boolean;
  }) => {
    debug('Pausing');
    if (isShutdown || isShuttingDown) {
      throw new Error('Cannot pause a shutdown worker.');
    }
    isPausing = true;
    await clearIntervalAsync(upsertInterval);
    (killProcessingTasks ? [takerQueue, workerQueue] : [takerQueue]).forEach(
      (q) => {
        q.pause();
        q.clear();
      },
    );
    await publish({
      channel: getWorkerPausedChannel({ queue }),
      message: serializeEvent({
        createdAt: new Date(),
        type: EventType.WorkerPaused,
        worker,
      }),
      client: workerClient,
    });
    const clients =
      killProcessingTasks && !redisClient
        ? [takerClient, workerClient]
        : [takerClient];
    await Promise.all([
      ...clients.map((client) => ensureDisconnected({ client })),
      ...[workerQueue, takerQueue].map((q) => q.onIdle()),
    ]);
    isPaused = true;
    isPausing = false;
    debug('Paused');
  };

  const start = async () => {
    debug('Starting');
    if (isShuttingDown || isShutdown) {
      throw new Error('Cannot start a shutdown worker.');
    }
    if (isPausing) {
      throw new Error('Cannot start a pausing worker.');
    }
    if (isPaused) {
      await Promise.all(
        [takerClient, workerClient].map((client) =>
          ensureConnected({ client }),
        ),
      );
      const queueRateLimitConfig = await getQueueRateLimitConfig({
        queue,
        client: workerClient,
      });
      if (
        queueRateLimitConfig &&
        queueRateLimitConfig.duration &&
        queueRateLimitConfig.points
      ) {
        setQueueRateLimit({
          points: queueRateLimitConfig.points,
          duration: queueRateLimitConfig.duration,
        });
      }
      [workerQueue, takerQueue].forEach((q) => q.start());
      await upsertWorker();
      upsertInterval = setIntervalAsync(upsertWorker, 15000);
      takerQueue.addAll(
        Array.from({ length: concurrency }).map(() => takeAndProcessTask),
      );
      isPaused = false;
      await publish({
        channel: getWorkerStartedChannel({ queue }),
        message: serializeEvent({
          createdAt: new Date(),
          type: EventType.WorkerStarted,
          worker,
        }),
        client: workerClient,
      });
      debug('Started');
    }
  };

  const shutdown = async ({
    killProcessingTasks,
  }: {
    killProcessingTasks?: boolean;
  }) => {
    debug('Shutting down');
    if (isShuttingDown || isShutdown) {
      throw new Error('Cannot shutdown an already shutdown worker.');
    }
    if (isPausing) {
      throw new Error('Cannot shutdown a pausing worker.');
    }
    isShuttingDown = true;
    await clearIntervalAsync(upsertInterval);
    (killProcessingTasks ? [takerQueue, workerQueue] : [takerQueue]).forEach(
      (q) => {
        q.pause();
        q.clear();
      },
    );
    await publish({
      channel: getWorkerStartedChannel({ queue }),
      message: serializeEvent({
        createdAt: new Date(),
        type: EventType.WorkerShutdown,
        worker,
      }),
      client: workerClient,
    });
    const clients =
      killProcessingTasks && !redisClient
        ? [takerClient, workerClient]
        : [takerClient];
    await Promise.all([
      ...clients.map((client) => ensureDisconnected({ client })),
      ...[workerQueue, takerQueue].map((q) => q.onIdle()),
    ]);
    isShutdown = true;
    isShuttingDown = false;
    debug('Shutdown');
  };

  const ready = async () => {
    await setupListener();
    if (autoStart) await start();
    if (onReady) onReady();
    debug('Ready');
  };
  const readyPromise = ready();

  return {
    id: worker.id,
    createdAt: worker.createdAt,
    onReady: async () => {
      debug('onReady');
      await readyPromise;
    },
    pause: async (killProcessingTasks?: boolean) => {
      await readyPromise;
      return pause({ killProcessingTasks });
    },
    start: () => start(),
    getQueueRateLimitConfig: async () => rateLimitConfig,
    shutdown: async (killProcessingTasks?: boolean) => {
      await readyPromise;
      return shutdown({ killProcessingTasks });
    },
    onIdle: async () => {
      debug('onIdle');
      await Promise.all([takerQueue, workerQueue].map((q) => q.onIdle()));
    },
  };
};

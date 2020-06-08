import { map, debounce, forEach } from 'lodash';
import PQueue from 'p-queue';
import {
  setIntervalAsync,
  clearIntervalAsync,
  SetIntervalAsyncTimer,
} from 'set-interval-async/dynamic';
import debugF from 'debug';
import { RedisConfig, sleep, createWorkerId } from '../utils/general';
import {
  getRetryDelayType,
  TaskSuccessCb,
  TaskErrorCb,
  TaskFailedCb,
  Handler,
} from './handle-task';
import {
  ensureConnected,
  tryIgnore,
  ensureDisconnected,
  publish,
  set,
  createClientAndLoadLuaScripts,
} from '../utils/redis';
import { takeTaskBlocking } from './take-task-blocking';
import { processTask } from './process-task';
import {
  getWorkerStartedChannel,
  getWorkerPausedChannel,
  getWorkerKey,
} from '../utils/keys';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';
import { Worker } from '../domain/workers/worker';
import { serializeWorker } from '../domain/workers/serialize-worker';
import { Task } from '../domain/tasks/task';

const debug = debugF('conveyor-mq:worker');

/**
 * Creates a worker which processes tasks on the queue.
 *
 * @param queue - The name of the queue.
 * @param redisConfig - Redis configuration.
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
}: {
  queue: string;
  redisConfig: RedisConfig;
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
}) => {
  debug('Starting');
  let isPausing = false;
  let isPaused = true;
  let isShuttingDown = false;
  let isShutdown = false;
  let upsertInterval: SetIntervalAsyncTimer;

  const worker: Worker = {
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
  const workerClient = createClientAndLoadLuaScripts(redisConfig);

  const isActive = () =>
    !isPausing && !isPaused && !isShuttingDown && !isShutdown;

  const takeAndProcessTask = async (t?: Task | null) => {
    debug(
      t
        ? `Processing pre-fetched task ${t.id}`
        : `Starting to check for tasks to process`,
    );
    try {
      const task =
        t ||
        (await tryIgnore(
          () =>
            takeTaskBlocking({
              queue,
              client: takerClient,
              client2: workerClient,
              stallTimeout: defaultStallTimeout,
            }),
          () => isActive(),
        ));
      if (task) {
        debug(`Adding task to worker queue ${task.id}`);
        const nextTask = await workerQueue.add(async () =>
          tryIgnore(
            async () => {
              debug(`Processing task ${task.id}`);
              const theNextTask = await processTask({
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
              });
              debug(`Processed task ${task.id}`);
              return theNextTask;
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
    forEach(
      killProcessingTasks ? [takerQueue, workerQueue] : [takerQueue],
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
    await Promise.all([
      ...map(
        killProcessingTasks ? [takerClient, workerClient] : [takerClient],
        (client) => ensureDisconnected({ client }),
      ),
      ...map([workerQueue, takerQueue], (q) => q.onIdle()),
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
      forEach([workerQueue, takerQueue], (q) => q.start());
      await Promise.all(
        map([takerClient, workerClient], (client) =>
          ensureConnected({ client }),
        ),
      );
      await upsertWorker();
      upsertInterval = setIntervalAsync(upsertWorker, 15000);
      takerQueue.addAll(
        map(Array.from({ length: concurrency }), () => takeAndProcessTask),
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
    forEach(
      killProcessingTasks ? [takerQueue, workerQueue] : [takerQueue],
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
    await Promise.all([
      ...map(
        killProcessingTasks ? [takerClient, workerClient] : [takerClient],
        (client) => ensureDisconnected({ client }),
      ),
      ...map([workerQueue, takerQueue], (q) => q.onIdle()),
    ]);
    isShutdown = true;
    isShuttingDown = false;
    debug('Shutdown');
  };

  const ready = async () => {
    if (autoStart) await start();
    if (onReady) onReady();
    debug('Ready');
  };
  const readyPromise = ready();

  return {
    onReady: async () => {
      debug('onReady');
      await readyPromise;
    },
    pause: async (killProcessingTasks?: boolean) => {
      await readyPromise;
      return pause({ killProcessingTasks });
    },
    start: () => start(),
    shutdown: async (killProcessingTasks?: boolean) => {
      await readyPromise;
      return shutdown({ killProcessingTasks });
    },
    onIdle: async () => {
      debug('onIdle');
      await Promise.all(map([takerQueue, workerQueue], (q) => q.onIdle()));
    },
  };
};

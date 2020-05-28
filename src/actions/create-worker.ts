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

export const createWorker = ({
  // Queue name:
  queue,
  // Redis configuration:
  redisConfig,
  defaultStallTimeout = 1000,
  defaultTaskAcknowledgementInterval,
  // A handler function to process tasks:
  handler,
  // The number of concurrent tasks the worker can processes:
  concurrency = 1,
  // The retry delay when retrying a task after it has errored:
  getRetryDelay,
  // Task success callback:
  onTaskSuccess,
  // Task error callback:
  onTaskError,
  // Task fail callback:
  onTaskFailed,
  onHandlerError,
  // Worker idle callback, called when the worker becomes idle:
  onIdle,
  // Amount of time since processing a task after which the worker is considered idle and the onIdle callback is called.
  idleTimeout = 250,
  // Worker ready callback, called once a worker is ready to start processing tasks:
  onReady,
  // Control whether the worker should start automatically, else worker.start() must be called manually:
  autoStart = true,
  // Remove tasks once they are processed successfully
  removeOnSuccess = false,
  // Remove tasks once they are fail to be processed successfully
  removeOnFailed = false,
}: {
  queue: string;
  redisConfig: RedisConfig;
  defaultStallTimeout?: number;
  defaultTaskAcknowledgementInterval?: number;
  handler: Handler;
  concurrency?: number;
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
      console.error(e.toString());
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
    pause: async (killProcessingTasks?: boolean) => {
      await readyPromise;
      return pause({ killProcessingTasks });
    },
    start: () => start(),
    shutdown: async (killProcessingTasks?: boolean) => {
      await readyPromise;
      return shutdown({ killProcessingTasks });
    },
    onReady: async () => {
      debug('onReady');
      await readyPromise;
    },
    onIdle: async () => {
      debug('onIdle');
      await Promise.all(map([takerQueue, workerQueue], (q) => q.onIdle()));
    },
  };
};

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import debugF from 'debug';
import { Redis } from 'ioredis';
import { enqueueTasks as enqueueTasksAction } from './enqueue-tasks';
import {
  ensureDisconnected,
  createClientAndLoadLuaScripts,
  RedisConfig,
} from '../utils/redis';
import { getTaskById } from './get-task-by-id';
import { getTasksById } from './get-tasks-by-id';
import { Task } from '../domain/tasks/task';
import { Event } from '../domain/events/event';
import { createListener } from './create-listener';
import { EventType } from '../domain/events/event-type';
import { TaskStatus } from '../domain/tasks/task-status';
import { getTaskCounts } from './get-task-counts';
import { destroyQueue } from './destroy-queue';
import { removeTaskById } from './remove-task-by-id';
import { scheduleTasks as scheduleTasksAction } from './schedule-tasks';
import { getWorkers } from './get-workers';
import { pauseQueue } from './pause-queue';
import { resumeQueue } from './resume-queue';
import { Manager } from '../domain/manager/manager';
import { TaskResponse } from '../domain/manager/task-response';
import { OnBeforeEnqueueTask, OnAfterEnqueueTask } from './enqueue-task';
import { setQueueRateLimit } from './set-queue-rate-limit';
import { QueueRateLimitConfig } from './get-queue-rate-limit-config';

const debug = debugF('conveyor-mq:manager');

export interface ManagerInput {
  queue: string;
  redisConfig: RedisConfig;
  redisClient?: Redis;
  queueRateLimitConfig?: QueueRateLimitConfig;
  hooks?: {
    onBeforeEnqueueTask?: OnBeforeEnqueueTask;
    onAfterEnqueueTask?: OnAfterEnqueueTask;
  };
}

/**
 * Creates a manager which is responsible for enqueuing tasks, as well as querying various
 * queue, task and worker properties.
 *
 * @param queue - The name of the queue.
 * @param redisConfig - Redis configuration.
 * @param redisClient - An optional Redis client for the manager to re-use. The client
 * must have lua scripts loaded which can be done by calling loadLuaScripts({ client }).
 * @returns manager
 * - .enqueueTask(task): Promise<Task> - Enqueues a task on the queue.
 * - .enqueueTasks(tasks): Promise<Task[]> - Enqueues multiple tasks on the queue in a single transaction.
 * - .scheduleTask(task): Promise<Task> - Schedules a task to be enqueued at a future date.
 * - .scheduleTasks(tasks): Promise<Task[]> - Schedules multiple tasks in a single transaction.
 * - .onTaskCompete(taskId): Promise<Task> - Returns a promise which resolves once the task is complete.
 * - .getTaskById(taskId): Promise<Task> - Gets a task.
 * - .getTasksById(taskIds): Promise<Task[]>  - Gets a list of tasks in a single transaction.
 * - .getTaskCounts(): Promise<object> - Gets task counts by status.
 * - .getWorkers(): Promise<Worker[]> - Gets workers on the queue.
 * - .removeTaskById(taskId): Promise<void> - Removes a task from the queue.
 * - .destroyQueue(): Promise<void> - Destroys the queue by removing all data & data structures.
 * - .pauseQueue(): Promise<void> - Pauses the queue.
 * - .resumeQueue(): Promise<void> - Resumes the queue.
 * - .setQueueRateLimit({ points, duration }): Promise<void> - Sets the rate limit on the queue.
 * - .onReady(): Promise<void> - Returns a promise which resolves once the manager is ready.
 * - .quit(): Promise<void> - Quits the manager, disconnects the redis clients.
 */
export const createManager = ({
  queue,
  redisConfig,
  redisClient,
  queueRateLimitConfig,
  hooks,
}: ManagerInput): Manager => {
  debug('Starting');
  debug('Creating client');
  const client = redisClient || createClientAndLoadLuaScripts(redisConfig);

  const eventSubscriptions: {
    [key: string]: { [key: string]: (({ event }: { event: Event }) => any)[] };
  } = {};

  const setupListener = async () => {
    const listener = createListener({
      queue,
      redisConfig,
      events: [EventType.TaskComplete],
    });
    debug('Created listener');
    listener.on(EventType.TaskComplete, ({ event }) => {
      if (!event || !event.task || !event.task.id) return;
      const { task } = event;
      const handlers = eventSubscriptions?.[EventType.TaskComplete]?.[task.id];
      forEach(handlers || [], (handler) => {
        handler({ event });
      });
      if (handlers) {
        delete eventSubscriptions[EventType.TaskComplete][task.id];
      }
    });
    debug('Registered listener');
  };
  const listenerSetupPromise = setupListener();

  const onTaskComplete = async ({ taskId }: { taskId: string }) => {
    const promise = new Promise((resolve) => {
      set(eventSubscriptions, `${EventType.TaskComplete}.${taskId}`, [
        ...(eventSubscriptions?.[EventType.TaskComplete]?.[taskId] || []),
        ({ event }: { event: Event }) => resolve(event.task),
      ]);
    }) as Promise<Task>;
    const task = await getTaskById({ queue, taskId, client });
    if (
      task &&
      task.status &&
      [(TaskStatus.Failed, TaskStatus.Success)].includes(task.status)
    ) {
      delete eventSubscriptions[EventType.TaskComplete][taskId];
      return task;
    }
    return promise;
  };

  const enqueueTasks = async ({
    tasks,
  }: {
    tasks: Partial<Task>[];
  }): Promise<TaskResponse[]> => {
    const enqueuedTasks = await enqueueTasksAction({
      queue,
      tasks,
      client,
      onBeforeEnqueueTask: hooks?.onBeforeEnqueueTask,
      onAfterEnqueueTask: hooks?.onAfterEnqueueTask,
    });
    return map(enqueuedTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete({ taskId: task.id }),
    }));
  };

  const enqueueTask = async ({
    task,
  }: {
    task: Partial<Task>;
  }): Promise<TaskResponse> => {
    const [result] = await enqueueTasks({ tasks: [task] });
    return result;
  };

  const scheduleTasks = async ({
    tasks,
  }: {
    tasks: Partial<Task>[];
  }): Promise<TaskResponse[]> => {
    const scheduledTasks = await scheduleTasksAction({ tasks, queue, client });
    return map(scheduledTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete({ taskId: task.id }),
    }));
  };

  const scheduleTask = async ({
    task,
  }: {
    task: Partial<Task>;
  }): Promise<TaskResponse> => {
    const [result] = await scheduleTasks({ tasks: [task] });
    return result;
  };

  const ready = async () => {
    await Promise.all([listenerSetupPromise]);
    if (queueRateLimitConfig) {
      await setQueueRateLimit({
        points: queueRateLimitConfig.points,
        duration: queueRateLimitConfig.duration,
        queue,
        client,
      });
    }
    debug('Ready');
  };
  const readyPromise = ready();

  return {
    enqueueTask: async (task: Partial<Task>) => {
      await readyPromise;
      debug(`enqueueTask ${task}`);
      return enqueueTask({ task });
    },
    enqueueTasks: async (tasks: Partial<Task>[]) => {
      await readyPromise;
      debug(`enqueueTasks ${tasks}`);
      return enqueueTasks({ tasks });
    },
    scheduleTask: async (task: Partial<Task>) => {
      await readyPromise;
      debug(`scheduleTask ${task}`);
      return scheduleTask({ task });
    },
    scheduleTasks: async (tasks: Partial<Task>[]) => {
      await readyPromise;
      debug(`scheduleTasks ${tasks}`);
      return scheduleTasks({ tasks });
    },
    onTaskComplete: async (taskId: string) => {
      await readyPromise;
      debug(`onTaskComplete ${taskId}`);
      return onTaskComplete({ taskId });
    },
    getTaskById: async (taskId: string) => {
      await readyPromise;
      debug(`getTaskById ${taskId}`);
      return getTaskById({ queue, taskId, client });
    },
    getTasksById: async (taskIds: string[]) => {
      await readyPromise;
      debug(`getTasksById ${taskIds}`);
      return getTasksById({ queue, taskIds, client });
    },
    getTaskCounts: async () => {
      await readyPromise;
      debug(`getTaskCounts`);
      return getTaskCounts({ queue, client });
    },
    getWorkers: async () => {
      await readyPromise;
      debug(`getWorkers`);
      return getWorkers({ queue, client });
    },
    removeTaskById: async (taskId: string) => {
      await readyPromise;
      debug(`removeTaskById ${taskId}`);
      return removeTaskById({ taskId, queue, client });
    },
    destroyQueue: async () => {
      await readyPromise;
      debug(`destroyQueue`);
      return destroyQueue({ queue, client });
    },
    pauseQueue: async () => {
      await readyPromise;
      debug(`pauseQueue`);
      return pauseQueue({ queue, client });
    },
    resumeQueue: async () => {
      await readyPromise;
      debug(`resumeQueue`);
      return resumeQueue({ queue, client });
    },
    setQueueRateLimit: async ({
      points,
      duration,
    }: {
      points: number;
      duration: number;
    }) => {
      await readyPromise;
      await setQueueRateLimit({ points, duration, queue, client });
    },
    onReady: async () => {
      await readyPromise;
      debug(`onReady`);
    },
    quit: async () => {
      await readyPromise;
      debug(`quit`);
      if (!redisClient) {
        await ensureDisconnected({ client });
      }
    },
  };
};

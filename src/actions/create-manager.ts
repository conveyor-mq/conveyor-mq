/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import { Redis } from 'ioredis';
import { enqueueTasks as enqueueTasksAction } from './enqueue-tasks';
import { createClient, ensureDisconnected } from '../utils/redis';
import { getTaskById } from './get-task-by-id';
import { getTasksById } from './get-tasks-by-id';
import { RedisConfig } from '../utils/general';
import { Task } from '../domain/tasks/task';
import { Event } from '../domain/events/event';
import { createListener } from './create-listener';
import { EventType } from '../domain/events/event-type';
import { TaskStatus } from '../domain/tasks/task-status';
import { getTaskCounts } from './get-task-counts';
import { destroyQueue as destroyQueueAction } from './destroy-queue';
import { removeTaskById } from './remove-task-by-id';
import { scheduleTasks as scheduleTasksAction } from './schedule-tasks';
import { getWorkers } from './get-workers';
import { pauseQueue } from './pause-queue';
import { resumeQueue } from './resume-queue';

/**
 * @ignore
 */
const promiseKey = (taskId: string) => `${taskId}-promise`;

export interface TaskResponse {
  task: Task;
  onTaskComplete: () => Promise<Task>;
}

export const createManager = ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  const clientPromise = createClient(redisConfig);

  const eventSubscriptions: {
    [key: string]: { [key: string]: ({ event }: { event: Event }) => any };
  } = {};

  const setupListener = async () => {
    const listener = await createListener({ queue, redisConfig });
    listener.on(EventType.TaskComplete, ({ event }) => {
      if (!event || !event.task || !event.task.id) return;
      const { task } = event;
      const subscriptions = map([promiseKey], (keyFunc) => ({
        key: keyFunc(task.id),
        handler:
          eventSubscriptions?.[EventType.TaskComplete]?.[keyFunc(task.id)],
      }));
      forEach(subscriptions, (subscription) => {
        if (subscription.handler) {
          subscription.handler({ event });
          delete eventSubscriptions[EventType.TaskComplete][subscription.key];
        }
      });
    });
  };
  const listenerSetupPromise = setupListener();

  const onTaskComplete = async ({
    taskId,
    client,
  }: {
    taskId: string;
    client: Redis;
  }) => {
    const promise = new Promise((resolve) => {
      set(
        eventSubscriptions,
        `${EventType.TaskComplete}.${promiseKey(taskId)}`,
        ({ event }: { event: Event }) => resolve(event.task),
      );
    }) as Promise<Task>;
    const task = await getTaskById({ queue, taskId, client });
    if (
      task &&
      task.status &&
      [(TaskStatus.Failed, TaskStatus.Success)].includes(task.status)
    ) {
      delete eventSubscriptions[EventType.TaskComplete][promiseKey(taskId)];
      return task;
    }
    return promise;
  };

  const enqueueTasks = async ({
    tasks,
    client,
  }: {
    tasks: Partial<Task>[];
    client: Redis;
  }): Promise<TaskResponse[]> => {
    const enqueuedTasks = await enqueueTasksAction({ queue, tasks, client });
    return map(enqueuedTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete({ taskId: task.id, client }),
    }));
  };

  const enqueueTask = async ({
    task,
    client,
  }: {
    task: Partial<Task>;
    client: Redis;
  }): Promise<TaskResponse> => {
    const [result] = await enqueueTasks({ tasks: [task], client });
    return result;
  };

  const scheduleTasks = async ({
    tasks,
    client,
  }: {
    tasks: Partial<Task>[];
    client: Redis;
  }): Promise<TaskResponse[]> => {
    const scheduledTasks = await scheduleTasksAction({ tasks, queue, client });
    return map(scheduledTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete({ taskId: task.id, client }),
    }));
  };

  const scheduleTask = async ({
    task,
    client,
  }: {
    task: Partial<Task>;
    client: Redis;
  }): Promise<TaskResponse> => {
    const [result] = await scheduleTasks({ tasks: [task], client });
    return result;
  };

  const withReady = <F, G>(f: (args: G) => F) => {
    return async (args: G) => {
      await Promise.all([clientPromise, listenerSetupPromise]);
      return f(args);
    };
  };

  const withClient = <F, H>(f: (args: H) => F) => {
    return async (args: any) => {
      const client = await clientPromise;
      return f({ client, ...args });
    };
  };

  return {
    enqueueTask: async (task: Partial<Task>) =>
      withClient(withReady(enqueueTask))({ task }),
    enqueueTasks: async (tasks: Partial<Task>[]) =>
      withClient(withReady(enqueueTasks))({ tasks }),
    scheduleTask: async (task: Partial<Task>) =>
      withClient(withReady(scheduleTask))({ task }),
    scheduleTasks: async (tasks: Partial<Task>[]) =>
      withClient(withReady(scheduleTasks))({ tasks }),
    onTaskComplete: async (taskId: string) =>
      withClient(withReady(onTaskComplete))({ taskId }),
    getTaskById: async (taskId: string) =>
      withClient(withReady(getTaskById))({ taskId, queue }),
    getTasksById: async (taskIds: string[]) =>
      withClient(withReady(getTasksById))({ taskIds, queue }),
    getTaskCounts: async () => withClient(withReady(getTaskCounts))({ queue }),
    getWorkers: async () => withClient(withReady(getWorkers))({ queue }),
    removeTaskById: async (taskId: string) =>
      withClient(withReady(removeTaskById))({ taskId, queue }),
    destroyQueue: async () =>
      withClient(withReady(destroyQueueAction))({ queue }),
    pauseQueue: async () => withClient(withReady(pauseQueue))({ queue }),
    resumeQueue: () => withClient(withReady(resumeQueue))({ queue }),
    onReady: async () => {
      await Promise.all([clientPromise, listenerSetupPromise]);
    },
    quit: async () => withClient(withReady(ensureDisconnected))({ queue }),
  };
};

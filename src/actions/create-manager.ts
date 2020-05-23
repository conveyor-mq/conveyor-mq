/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import { enqueueTasks as enqueueTasksAction } from './enqueue-tasks';
import { createClient, ensureDisconnected } from '../utils/redis';
import { getTaskById } from './get-task-by-id';
import { getTasksById } from './get-tasks-by-id';
import { RedisConfig } from '../utils/general';
import { Task } from '../domain/tasks/task';
import { Event } from '../domain/events/event';
import { createListener } from './create-listener';
import { EventTypes } from '../domain/events/event-types';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { getTaskCounts } from './get-task-counts';
import { destroyQueue as destroyQueueAction } from './destroy-queue';
import { removeTaskById } from './remove-task-by-id';
import { scheduleTasks as scheduleTasksAction } from './schedule-tasks';

/**
 * @ignore
 */
const callbackKey = (taskId: string) => `${taskId}-cb`;

/**
 * @ignore
 */
const promiseKey = (taskId: string) => `${taskId}-promise`;

export interface TaskResponse {
  task: Task;
  onTaskComplete: () => Promise<Task>;
}

export const createManager = async ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  const [client, listener] = await Promise.all([
    createClient(redisConfig),
    createListener({ queue, redisConfig }),
  ]);

  const eventSubscriptions: {
    [key: string]: { [key: string]: ({ event }: { event: Event }) => any };
  } = {};

  listener.on(EventTypes.TaskComplete, ({ event }) => {
    if (!event || !event.task || !event.task.id) return;
    const subscriptions = map([callbackKey, promiseKey], (keyFunc) => ({
      key: keyFunc(event!.task!.id),
      handler:
        eventSubscriptions?.[EventTypes.TaskComplete]?.[
          keyFunc(event!.task!.id)
        ],
    }));
    forEach(subscriptions, (subscription) => {
      if (subscription.handler) {
        subscription.handler({ event });
        delete eventSubscriptions[EventTypes.TaskComplete][subscription.key];
      }
    });
  });

  const onTaskComplete = async (taskId: string) => {
    const promise = new Promise((resolve) => {
      set(
        eventSubscriptions,
        `${EventTypes.TaskComplete}.${promiseKey(taskId)}`,
        ({ event }: { event: Event }) => resolve(event.task),
      );
    }) as Promise<Task>;
    const task = await getTaskById({ queue, taskId, client });
    if (
      task &&
      task.status &&
      [(TaskStatuses.Failed, TaskStatuses.Success)].includes(task.status)
    ) {
      delete eventSubscriptions[promiseKey(taskId)];
      return task;
    }
    return promise;
  };

  const enqueueTasks = async (
    tasks: Partial<Task>[],
  ): Promise<TaskResponse[]> => {
    const enqueuedTasks = await enqueueTasksAction({ queue, tasks, client });
    return map(enqueuedTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete(task.id),
    }));
  };

  const enqueueTask = async (task: Partial<Task>): Promise<TaskResponse> => {
    const [result] = await enqueueTasks([task]);
    return result;
  };

  const scheduleTasks = async (
    tasks: Partial<Task>[],
  ): Promise<TaskResponse[]> => {
    const scheduledTasks = await scheduleTasksAction({ tasks, queue, client });
    return map(scheduledTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete(task.id),
    }));
  };

  const scheduleTask = async (task: Partial<Task>): Promise<TaskResponse> => {
    const [result] = await scheduleTasks([task]);
    return result;
  };

  return {
    enqueueTask,
    enqueueTasks,
    scheduleTask,
    scheduleTasks,
    onTaskComplete,
    getTaskById: (taskId: string) => getTaskById({ taskId, queue, client }),
    getTasksById: (taskIds: string[]) =>
      getTasksById({ taskIds, queue, client }),
    getTaskCounts: () => getTaskCounts({ queue, client }),
    removeTaskById: (taskId: string) =>
      removeTaskById({ taskId, queue, client }),
    destroyQueue: () => destroyQueueAction({ queue, client }),
    quit: () => ensureDisconnected({ client }),
  };
};

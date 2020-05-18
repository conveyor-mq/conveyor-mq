/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import { enqueueTasks as enqueueTasksAction } from './enqueue-tasks';
import { createClient, ensureDisconnected } from '../utils/redis';
import { getTaskById } from './get-task-by-id';
import { getTasksById } from './get-tasks-by-id';
import { RedisConfig, createTaskId } from '../utils/general';
import { Task } from '../domain/tasks/task';
import { Event } from '../domain/events/event';
import { createListener } from './create-listener';
import { EventTypes } from '../domain/events/event-types';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { getTaskCounts } from './get-task-counts';
import { destroyQueue as destroyQueueAction } from './destroy-queue';

/**
 * @ignore
 */
const callbackKey = (taskId: string) => `${taskId}-cb`;

/**
 * @ignore
 */
const promiseKey = (taskId: string) => `${taskId}-promise`;

/**
 * Regular description
 *
 */
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

  const onTaskComplete = async ({ taskId }: { taskId: string }) => {
    const promise = new Promise((resolve) => {
      set(
        eventSubscriptions,
        `${EventTypes.TaskComplete}.${promiseKey(taskId)}`,
        ({ event }: { event: Event }) => resolve(event.task),
      );
    });
    const task = await getTaskById({ queue, taskId, client });
    if (
      task &&
      task.status &&
      [(TaskStatuses.Failed, TaskStatuses.Success)].includes(task.status)
    ) {
      delete eventSubscriptions[promiseKey(taskId)];
      return task;
    }
    return promise as Promise<Task>;
  };

  const enqueueTasks = async (
    params: {
      task: Partial<Task>;
      onTaskComplete?: ({ event }: { event: Event }) => any;
    }[],
  ) => {
    const tasks: Task[] = map(
      params,
      ({ task, onTaskComplete: onTaskCompleteCb }) => {
        const taskId = task.id || createTaskId();
        if (onTaskCompleteCb) {
          set(
            eventSubscriptions,
            `${EventTypes.TaskComplete}.${callbackKey(taskId)}`,
            onTaskCompleteCb,
          );
        }
        return { ...task, id: taskId };
      },
    );
    const enqueuedTasks = await enqueueTasksAction({ queue, tasks, client });
    return map(enqueuedTasks, (task) => ({
      task,
      onTaskComplete: () => onTaskComplete({ taskId: task.id }),
    }));
  };

  const enqueueTask = async ({
    task,
    onTaskComplete: onTaskCompleteCb,
  }: {
    task: Partial<Task>;
    onTaskComplete?: ({ event }: { event: Event }) => any;
  }) => {
    const [result] = await enqueueTasks([
      { task, onTaskComplete: onTaskCompleteCb },
    ]);
    return result;
  };

  return {
    enqueueTask,
    enqueueTasks,
    onTaskComplete,
    getTaskCounts: () => getTaskCounts({ queue, client }),
    getTaskById: (taskId: string) => getTaskById({ taskId, queue, client }),
    getTasksById: (taskIds: string[]) =>
      getTasksById({ taskIds, queue, client }),
    destroyQueue: () => destroyQueueAction({ queue, client }),
    quit: () => ensureDisconnected({ client }),
  };
};

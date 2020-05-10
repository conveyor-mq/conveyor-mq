/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import { enqueueTask } from './enqueue-task';
import { enqueueTasks } from './enqueue-tasks';
import { createClient } from '../utils/redis';
import { getTask } from './get-task';
import { getTasks } from './get-tasks';
import { RedisConfig, createUuid, createTaskId } from '../utils/general';
import { Task } from '../domain/tasks/task';
import { Event } from '../domain/events/event';
import { createListener } from './create-listener';
import { EventTypes } from '../domain/events/event-types';
import { TaskStatuses } from '../domain/tasks/task-statuses';

const callbackKey = (taskId: string) => `${taskId}-cb`;
const promiseKey = (taskId: string) => `${taskId}-promise`;

export const createManager = async ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  const client = await createClient(redisConfig);
  const listener = await createListener({ queue, redisConfig });

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
    forEach(map(subscriptions), (key) => {
      if (key.handler) {
        key.handler({ event });
        delete eventSubscriptions[EventTypes.TaskComplete][key.key];
      }
    });
  });

  const managerEnqueueTask = async ({
    task,
    onTaskComplete,
  }: {
    task: Task;
    onTaskComplete?: ({ event }: { event: Event }) => any;
  }) => {
    const taskId = task.id || createTaskId();
    if (onTaskComplete) {
      set(
        eventSubscriptions,
        `${EventTypes.TaskComplete}.${callbackKey(taskId)}`,
        onTaskComplete,
      );
    }
    const enqueuedTask = await enqueueTask({
      task: { ...task, id: taskId },
      queue,
      client,
    });
    return { task: enqueuedTask };
  };

  const managerOnTaskComplete = async ({ taskId }: { taskId: string }) => {
    const promise = new Promise((resolve) => {
      set(
        eventSubscriptions,
        `${EventTypes.TaskComplete}.${promiseKey(taskId)}`,
        ({ event }: { event: Event }) => resolve(event.task),
      );
    });
    const task = await getTask({ queue, taskId, client });
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

  return {
    enqueueTask: managerEnqueueTask,
    onTaskComplete: managerOnTaskComplete,
    enqueueTasks: (tasks: Partial<Task>[]) =>
      enqueueTasks({ tasks, queue, client }),
    getTask: (taskId: string) => getTask({ taskId, queue, client }),
    getTasks: (taskIds: string[]) => getTasks({ taskIds, queue, client }),
    quit: async () => {
      await client.disconnect();
    },
  };
};

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import debugF from 'debug';
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
import { destroyQueue } from './destroy-queue';
import { removeTaskById } from './remove-task-by-id';
import { scheduleTasks as scheduleTasksAction } from './schedule-tasks';
import { getWorkers } from './get-workers';
import { pauseQueue } from './pause-queue';
import { resumeQueue } from './resume-queue';

const debug = debugF('conveyor-mq:manager');

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
  debug('Starting');
  debug('Creating client');
  const clientPromise = createClient(redisConfig);

  const eventSubscriptions: {
    [key: string]: { [key: string]: ({ event }: { event: Event }) => any };
  } = {};

  const setupListener = async () => {
    const listener = await createListener({
      queue,
      redisConfig,
      events: [EventType.TaskComplete],
    });
    debug('Created listener');
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
    debug('Registered listener');
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

  const ready = async () => {
    await Promise.all([clientPromise, listenerSetupPromise]);
    debug('Ready');
  };
  const readyPromise = ready();

  return {
    enqueueTask: async (task: Partial<Task>) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`enqueueTask ${task}`);
      return enqueueTask({ task, client });
    },
    enqueueTasks: async (tasks: Partial<Task>[]) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`enqueueTasks ${tasks}`);
      return enqueueTasks({ tasks, client });
    },
    scheduleTask: async (task: Partial<Task>) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`scheduleTask ${task}`);
      return scheduleTask({ task, client });
    },
    scheduleTasks: async (tasks: Partial<Task>[]) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`scheduleTasks ${tasks}`);
      return scheduleTasks({ tasks, client });
    },
    onTaskComplete: async (taskId: string) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`onTaskComplete ${taskId}`);
      return onTaskComplete({ taskId, client });
    },
    getTaskById: async (taskId: string) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`getTaskById ${taskId}`);
      return getTaskById({ queue, taskId, client });
    },
    getTasksById: async (taskIds: string[]) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`getTasksById ${taskIds}`);
      return getTasksById({ queue, taskIds, client });
    },
    getTaskCounts: async () => {
      await readyPromise;
      const client = await clientPromise;
      debug(`getTaskCounts`);
      return getTaskCounts({ queue, client });
    },
    getWorkers: async () => {
      await readyPromise;
      const client = await clientPromise;
      debug(`getWorkers`);
      return getWorkers({ queue, client });
    },
    removeTaskById: async (taskId: string) => {
      await readyPromise;
      const client = await clientPromise;
      debug(`removeTaskById ${taskId}`);
      return removeTaskById({ taskId, queue, client });
    },
    destroyQueue: async () => {
      await readyPromise;
      const client = await clientPromise;
      debug(`destroyQueue`);
      return destroyQueue({ queue, client });
    },
    pauseQueue: async () => {
      await readyPromise;
      const client = await clientPromise;
      debug(`pauseQueue`);
      return pauseQueue({ queue, client });
    },
    resumeQueue: async () => {
      await readyPromise;
      const client = await clientPromise;
      debug(`resumeQueue`);
      return resumeQueue({ queue, client });
    },
    onReady: async () => {
      debug(`onReady`);
      await Promise.all([clientPromise, listenerSetupPromise]);
    },
    quit: async () => {
      await readyPromise;
      const client = await clientPromise;
      debug(`quit`);
      return ensureDisconnected({ client });
    },
  };
};

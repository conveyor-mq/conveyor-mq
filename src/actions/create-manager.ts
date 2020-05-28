/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { forEach, map, set } from 'lodash';
import debugF from 'debug';
import { enqueueTasks as enqueueTasksAction } from './enqueue-tasks';
import {
  ensureDisconnected,
  createClientAndLoadLuaScripts,
} from '../utils/redis';
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
  const client = createClientAndLoadLuaScripts(redisConfig);

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

  const onTaskComplete = async ({ taskId }: { taskId: string }) => {
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
  }: {
    tasks: Partial<Task>[];
  }): Promise<TaskResponse[]> => {
    const enqueuedTasks = await enqueueTasksAction({ queue, tasks, client });
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
    onReady: async () => {
      await readyPromise;
      debug(`onReady`);
    },
    quit: async () => {
      await readyPromise;
      debug(`quit`);
      return ensureDisconnected({ client });
    },
  };
};

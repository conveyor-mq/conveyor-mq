/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { RedisClient } from 'redis';
import { Moment } from 'moment';
import { set, get, rpop, brpop } from './utils';

import moment = require('moment');

export enum TaskStatuses {
  Queued = 'queued',
  Processing = 'processing',
  Success = 'success',
  Failed = 'failed',
}

export interface Task {
  id: string;
  status?: TaskStatuses;
  data?: any;
  result?: any;
  error?: any;
  expiresOn?: Moment;
}

export const getTaskKey = ({
  taskId,
  queue,
}: {
  taskId: string;
  queue: string;
}) => {
  return `${queue}:tasks:${taskId}`;
};

export const getQueuedListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:queued`;

export const getProcessingListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:processing`;

export const getHandlerKey = ({
  handlerId,
  queue,
}: {
  handlerId: string;
  queue: string;
}) => {
  return `${queue}:handlers:${handlerId}`;
};

export const serializeTask = (task: Task) => {
  return JSON.stringify(task);
};

export const deSerializeTask = (taskString: string) => {
  return JSON.parse(taskString);
};

export const getTask = async ({
  queue,
  taskId,
  client,
}: {
  queue: string;
  taskId: string;
  client: RedisClient;
}): Promise<Task | null> => {
  const taskKey = getTaskKey({ taskId, queue });
  const taskString = await get({ client, key: taskKey });
  if (taskString === null) return null;
  const task = deSerializeTask(taskString);
  return task;
};

export const putTask = async ({
  queue,
  task,
  client,
}: {
  queue: string;
  task: Task;
  client: RedisClient;
}): Promise<Task> => {
  const queuedTask = { ...task, status: TaskStatuses.Queued };
  const taskString = serializeTask(queuedTask);
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const queuedListKey = getQueuedListKey({ queue });
  return new Promise((resolve, reject) => {
    client.watch(taskKey, err => {
      if (err) throw err;
      client
        .multi()
        .set(taskKey, taskString)
        .lpush(queuedListKey, task.id)
        .exec((multiErr, result) => {
          if (multiErr) reject(multiErr);
          if (result === null) reject(new Error('Multi command failed.'));
          resolve(queuedTask);
        });
    });
  });
};

export const markTaskSuccess = async ({
  task,
  queue,
  client,
  result,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  result?: any;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const successTask = { ...task, status: TaskStatuses.Success, result };
  await set({
    key: taskKey,
    value: serializeTask(successTask),
    client,
  });
  return successTask;
};

export const markTaskFailed = async ({
  task,
  queue,
  client,
  error,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  error?: any;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const failedTask: Task = { ...task, status: TaskStatuses.Failed, error };
  await set({
    key: taskKey,
    value: serializeTask(failedTask),
    client,
  });
  return failedTask;
};

export const takeTask = async ({
  queue,
  client,
}: {
  queue: string;
  client: RedisClient;
}): Promise<Task | null> => {
  const taskId = await rpop({
    key: getQueuedListKey({ queue }),
    client,
  });
  if (taskId === null) return null;
  const task = await getTask({ queue, taskId, client });
  if (task === null) return null;
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const processingTask = { ...task, status: TaskStatuses.Processing };
  await set({
    key: taskKey,
    value: serializeTask(processingTask),
    client,
  });
  return processingTask;
};

export const takeTaskBlocking = async ({
  timeout = 0,
  queue,
  client,
}: {
  timeout?: number;
  queue: string;
  client: RedisClient;
}): Promise<Task | null> => {
  const response = await brpop({
    key: getQueuedListKey({ queue }),
    timeout,
    client,
  });
  if (!response || !response[1]) return null;
  const taskId = response[1];
  const task = await getTask({ queue, taskId, client });
  if (task === null) return null;
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const processingTask = { ...task, status: TaskStatuses.Processing };
  await set({
    key: taskKey,
    value: serializeTask(processingTask),
    client,
  });
  return processingTask;
};

export type HandlerF = ({ task }: { task: Task }) => any;

export const hasTaskExpired = ({
  task,
  asOf,
}: {
  task: Task;
  asOf: Moment;
}) => {
  return !!task.expiresOn && task.expiresOn < asOf;
};

export const handleTask = async ({
  task,
  queue,
  client,
  handler,
  asOf,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  handler: ({ task }: { task: Task }) => any;
  asOf: Moment;
}): Promise<any> => {
  if (!task || hasTaskExpired({ task, asOf })) return null;
  try {
    const result = await handler({ task });
    await markTaskSuccess({
      task,
      queue,
      client,
      result,
    });
    return result;
  } catch (e) {
    await markTaskFailed({ task, queue, client, error: e.message });
    return e;
  }
};

export const registerHandler = ({
  queue,
  handler,
  client,
}: {
  queue: string;
  handler: HandlerF;
  client: RedisClient;
}) => {
  const checkForAndHandleTask = async () => {
    const task = await takeTaskBlocking({ queue, client });
    if (task) {
      await handler({ task });
    }
    checkForAndHandleTask();
    return true;
  };
  checkForAndHandleTask();
  return handler;
};

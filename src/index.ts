/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { RedisClient } from 'redis';
import { Moment, utc as moment } from 'moment';
import { set, get, rpop, brpop } from './utils';

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
  maxAttempts?: number;
  attemptCount?: number;
  stalledAfter?: number;
  queuedOn?: Moment;
  processingStartedOn?: Moment;
  processingEndedOn?: Moment;
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

export const serializeTask = (task: Task) => {
  return JSON.stringify(task);
};

export const deSerializeTask = (taskString: string): Task => {
  const taskJson = JSON.parse(taskString);
  return {
    id: taskJson.id,
    status: taskJson.status,
    data: taskJson.data,
    result: taskJson.result,
    error: taskJson.error,
    expiresOn: taskJson.expiresOn ? moment(taskJson.expiresOn) : undefined,
    maxAttempts: taskJson.maxAttempts,
    attemptCount: taskJson.attemptCount,
    stalledAfter: taskJson.stalledAfter,
    queuedOn: taskJson.queuedOn ? moment(taskJson.queuedOn) : undefined,
    processingStartedOn: taskJson.processingStartedOn
      ? moment(taskJson.processingStartedOn)
      : undefined,
    processingEndedOn: taskJson.processingEndedOn
      ? moment(taskJson.processingEndedOn)
      : undefined,
  };
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
  const queuedTask: Task = {
    ...task,
    queuedOn: moment(),
    processingStartedOn: undefined,
    processingEndedOn: undefined,
    status: TaskStatuses.Queued,
    attemptCount: task.attemptCount || 0,
  };
  const taskString = serializeTask(queuedTask);
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const queuedListKey = getQueuedListKey({ queue });
  return new Promise((resolve, reject) => {
    client.watch(taskKey, err => {
      if (err) reject(err);
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

export const updateTask = async ({
  task,
  queue,
  client,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  await set({
    key: taskKey,
    value: serializeTask(task),
    client,
  });
  return task;
};

export const markTaskProcessing = async ({
  task,
  queue,
  client,
  asOf,
  attemptNumber,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  asOf: Moment;
  attemptNumber: number;
}) => {
  return updateTask({
    task: {
      ...task,
      attemptCount: attemptNumber,
      processingStartedOn: asOf,
      processingEndedOn: undefined,
      status: TaskStatuses.Processing,
    },
    queue,
    client,
  });
};

export const markTaskSuccess = async ({
  task,
  queue,
  client,
  result,
  asOf,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  result?: any;
  asOf: Moment;
}) => {
  return updateTask({
    task: {
      ...task,
      processingEndedOn: asOf,
      status: TaskStatuses.Success,
      result,
    },
    queue,
    client,
  });
};

export const markTaskFailed = async ({
  task,
  queue,
  client,
  error,
  asOf,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  error?: any;
  asOf: Moment;
}) => {
  return updateTask({
    task: {
      ...task,
      processingEndedOn: asOf,
      status: TaskStatuses.Failed,
      error,
    },
    queue,
    client,
  });
};

// TODO: rpop, get and set in a multi.
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

// TODO: rpop, get and set in a multi.
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
}): Promise<any | null> => {
  if (!task) {
    console.warn('No task provided to handle.');
    return null;
  }
  if (hasTaskExpired({ task, asOf })) {
    console.warn('Not handling expired task.');
    return null;
  }
  const maxAttemptsExceeded =
    task.maxAttempts && (task.attemptCount || 0) >= task.maxAttempts;
  if (maxAttemptsExceeded) {
    console.warn('Task has exceeded its maxAttempts.');
    return null;
  }
  const processingTask = await markTaskProcessing({
    task,
    queue,
    client,
    asOf: moment(),
    attemptNumber: (task.attemptCount || 0) + 1,
  });
  try {
    const result = await handler({ task: processingTask });
    await markTaskSuccess({
      task: processingTask,
      queue,
      client,
      result,
      asOf: moment(),
    });
    return result;
  } catch (e) {
    const maxAttemptsExceededAfterProcessing =
      processingTask.maxAttempts &&
      processingTask.attemptCount &&
      processingTask.attemptCount < processingTask.maxAttempts;
    if (maxAttemptsExceededAfterProcessing) {
      await putTask({
        task: { ...processingTask, processingEndedOn: moment() },
        queue,
        client,
      });
      return null;
    }

    await markTaskFailed({
      task: processingTask,
      queue,
      client,
      error: e.message,
      asOf: moment(),
    });
    return e;
  }
};

export const registerHandler = ({
  queue,
  handler,
  client,
  concurrency = 1,
}: {
  queue: string;
  handler: ({ task, ...other }: { task: Task; other?: any }) => any;
  client: RedisClient;
  concurrency?: number;
}) => {
  const checkForAndHandleTask = async (localClient: RedisClient) => {
    const task = await takeTaskBlocking({ queue, client });
    if (task) {
      await handleTask({
        task,
        queue,
        client: localClient,
        asOf: moment(),
        handler,
      });
    }
    checkForAndHandleTask(localClient);
  };
  Array.from({ length: concurrency }).forEach(() => {
    checkForAndHandleTask(client.duplicate());
  });
};

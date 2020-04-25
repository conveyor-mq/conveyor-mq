import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { brpop, getQueuedListKey, getTaskKey, set } from '../utils';
import { getTask } from './get-task';
import { TaskStatuses } from '../domain/task-statuses';
import { serializeTask } from '../domain/serialize-task';

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
  const processingTask: Task = {
    ...task,
    processingStartedOn: moment(),
    status: TaskStatuses.Processing,
  };
  await set({
    key: taskKey,
    value: serializeTask(processingTask),
    client,
  });
  return processingTask;
};

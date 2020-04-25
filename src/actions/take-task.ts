import { RedisClient } from 'redis';
import { Task } from '../domain/task';
import { rpop, getQueuedListKey, getTaskKey, set } from '../utils';
import { getTask } from './get-task';
import { TaskStatuses } from '../domain/task-statuses';
import { serializeTask } from '../domain/serialize-task';

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

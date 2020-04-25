import { RedisClient } from 'redis';
import { getTaskKey, get } from '../utils';
import { deSerializeTask } from '../domain/deserialize-task';
import { Task } from '../domain/task';

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

import { RedisClient } from 'redis';
import { deSerializeTask } from '../domain/deserialize-task';
import { Task } from '../domain/task';
import { get } from '../utils/redis';
import { getTaskKey } from '../utils/keys';

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

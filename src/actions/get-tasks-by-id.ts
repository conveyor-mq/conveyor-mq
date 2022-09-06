import { Redis } from 'ioredis';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { Task } from '../domain/tasks/task';
import { getTaskKey } from '../utils/keys';
import { exec } from '../utils/redis';

/**
 * @ignore
 */
export const getTasksById = async ({
  queue,
  taskIds,
  client,
}: {
  queue: string;
  taskIds: string[];
  client: Redis;
}): Promise<Task[]> => {
  const multi = client.multi();
  taskIds.forEach((taskId) => {
    multi.get(getTaskKey({ taskId, queue }));
  });
  const results = await exec(multi);
  const nonNullResults = results.filter((result) => !!result) as string[];
  const tasks = nonNullResults.map((taskString) => deSerializeTask(taskString));
  return tasks;
};

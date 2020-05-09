import { Redis } from 'ioredis';
import { forEach, map, filter } from 'lodash';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { getTaskKey } from '../utils/keys';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';

export const getTasks = async ({
  queue,
  taskIds,
  client,
}: {
  queue: string;
  taskIds: string[];
  client: Redis;
}): Promise<Task[]> => {
  const multi = client.multi();
  forEach(taskIds, (taskId) => {
    multi.get(getTaskKey({ taskId, queue }));
  });
  const results = await exec(multi);
  const nonNullResults = filter(results, (result) => !!result) as string[];
  const tasks = map(nonNullResults, (taskString) =>
    deSerializeTask(taskString),
  );
  return tasks;
};

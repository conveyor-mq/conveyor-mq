import { RedisClient } from 'redis';
import { forEach, map, filter } from 'lodash';
import { deSerializeTask } from '../domain/deserialize-task';
import { Task } from '../domain/task';
import { getTaskKey } from '../utils/keys';

export const getTasks = async ({
  queue,
  taskIds,
  client,
}: {
  queue: string;
  taskIds: string[];
  client: RedisClient;
}): Promise<Task[]> => {
  const multi = client.multi();
  forEach(taskIds, (taskId) => {
    multi.get(getTaskKey({ taskId, queue }));
  });
  const promise = new Promise((resolve, reject) => {
    multi.exec((err, result) =>
      err || result === null
        ? reject(err || 'Multi command failed.')
        : resolve(result),
    );
  }) as Promise<(string | null)[]>;
  const results = await promise;
  const nonNullResults = filter(results, (result) => !!result) as string[];
  const tasks = map(nonNullResults, (taskString) =>
    deSerializeTask(taskString),
  );
  return tasks;
};

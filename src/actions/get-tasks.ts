import { Redis } from 'ioredis';
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
  client: Redis;
}): Promise<Task[]> => {
  const multi = client.multi();
  forEach(taskIds, (taskId) => {
    multi.get(getTaskKey({ taskId, queue }));
  });
  const promise = new Promise((resolve, reject) => {
    multi.exec((err, resultError) =>
      err
        ? reject(err || 'Multi command failed.')
        : resolve(map(resultError, (result) => result[1])),
    );
  }) as Promise<(string | null)[]>;
  const results = await promise;
  const nonNullResults = filter(results, (result) => !!result) as string[];
  const tasks = map(nonNullResults, (taskString) =>
    deSerializeTask(taskString),
  );
  return tasks;
};

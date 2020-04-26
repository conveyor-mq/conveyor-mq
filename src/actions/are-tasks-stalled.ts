import { Redis } from 'ioredis';
import { map, forEach, zipWith } from 'lodash';
import { getTaskAcknowledgedKey } from '../utils/keys';

// TODO: Check that tasks are in processing queue.
export const areTasksStalled = async ({
  taskIds,
  queue,
  client,
}: {
  taskIds: string[];
  queue: string;
  client: Redis;
}) => {
  const taskAcknowledgeKeys = map(taskIds, (taskId) =>
    getTaskAcknowledgedKey({ taskId, queue }),
  );
  const multi = client.multi();
  forEach(taskAcknowledgeKeys, (key) => {
    multi.exists(key);
  });
  const promise = new Promise((resolve, reject) => {
    multi.exec((err, results) =>
      err
        ? reject(err || 'Multi command failed.')
        : resolve(map(results, (result) => result[1])),
    );
  }) as Promise<number[]>;
  const results = await promise;
  return zipWith(taskIds, results, (taskId, result) => ({
    taskId,
    isStalled: result === 0,
  }));
};

import { Redis } from 'ioredis';
import { map, forEach, zipWith } from 'lodash';
import { getTaskAcknowledgedKey } from '../utils/keys';
import { exec } from '../utils/redis';

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
  const results = await exec(multi);
  return zipWith(taskIds, results, (taskId, result) => ({
    taskId,
    isStalled: result === 0,
  }));
};

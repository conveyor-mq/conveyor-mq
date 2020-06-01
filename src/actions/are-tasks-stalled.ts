import { Redis } from 'ioredis';
import { map, forEach, zipWith, reduce } from 'lodash';
import { getTaskAcknowledgedKey } from '../utils/keys';
import { exec } from '../utils/redis';
import { getStallingTaskIds } from './get-stalling-task-ids';

/**
 * @ignore
 */
export const areTasksStalled = async ({
  taskIds,
  queue,
  client,
}: {
  taskIds: string[];
  queue: string;
  client: Redis;
}) => {
  const stallingTasksIds = await getStallingTaskIds({ queue, client });
  const taskAcknowledgeKeys = map(stallingTasksIds, (taskId) =>
    getTaskAcknowledgedKey({ taskId, queue }),
  );
  const multi = client.multi();
  forEach(taskAcknowledgeKeys, (key) => {
    multi.exists(key);
  });
  const results = await exec(multi);
  const isStalledByTaskId: { [key: string]: boolean } = reduce(
    zipWith(stallingTasksIds, results, (taskId, result) => ({
      taskId,
      isStalled: result === 0,
    })),
    (acc, { taskId, isStalled }) => ({
      ...acc,
      [taskId]: isStalled,
    }),
    {},
  );
  return map(taskIds, (taskId) => ({
    taskId,
    isStalled: !!isStalledByTaskId[taskId],
  }));
};

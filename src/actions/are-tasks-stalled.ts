import { Redis } from 'ioredis';
import { zipWith } from '../utils/general';
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
  const taskAcknowledgeKeys = stallingTasksIds.map((taskId) =>
    getTaskAcknowledgedKey({ taskId, queue }),
  );
  const multi = client.multi();
  taskAcknowledgeKeys.forEach((key) => {
    multi.exists(key);
  });
  const results = await exec(multi);
  const isStalledByTaskId: { [key: string]: boolean } = zipWith(
    stallingTasksIds,
    results,
    (taskId, result) => ({
      taskId,
      isStalled: result === 0,
    }),
  ).reduce(
    (acc, { taskId, isStalled }) => ({
      ...acc,
      [taskId]: isStalled,
    }),
    {},
  );
  return taskIds.map((taskId) => ({
    taskId,
    isStalled: !!isStalledByTaskId[taskId],
  }));
};

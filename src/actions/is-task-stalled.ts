import { RedisClient } from 'redis';
import { getTaskStalledKey, exists } from '../utils';

export const isTaskStalled = async ({
  taskId,
  queue,
  client,
}: {
  taskId: string;
  queue: string;
  client: RedisClient;
}) => {
  const taskStalledKey = getTaskStalledKey({ taskId, queue });
  const isTaskAcknowledged = await exists({ key: taskStalledKey, client });
  return !isTaskAcknowledged;
};

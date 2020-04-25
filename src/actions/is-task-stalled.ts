import { RedisClient } from 'redis';
import { exists } from '../utils/redis';
import { getTaskAcknowledgedKey } from '../utils/keys';

export const isTaskStalled = async ({
  taskId,
  queue,
  client,
}: {
  taskId: string;
  queue: string;
  client: RedisClient;
}) => {
  const taskAcknowledgedKey = getTaskAcknowledgedKey({ taskId, queue });
  const isTaskAcknowledged = await exists({ key: taskAcknowledgedKey, client });
  return !isTaskAcknowledged;
};

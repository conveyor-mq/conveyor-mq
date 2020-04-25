import { RedisClient } from 'redis';
import moment from 'moment';
import { set } from '../utils/redis';
import { getTaskAcknowledgedKey } from '../utils/keys';

export const acknowledgeTask = async ({
  taskId,
  queue,
  client,
  ttl = 1000,
}: {
  taskId: string;
  queue: string;
  client: RedisClient;
  ttl?: number;
}) => {
  const taskStalledKey = getTaskAcknowledgedKey({ taskId, queue });
  await set({
    key: taskStalledKey,
    value: moment().add(ttl, 'milliseconds').toISOString(),
    ttl,
    client,
  });
};

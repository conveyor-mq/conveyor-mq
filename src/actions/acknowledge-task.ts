import { Redis } from 'ioredis';
import { addByMsToISO } from '../utils/date';
import { getTaskAcknowledgedKey } from '../utils/keys';
import { set } from '../utils/redis';

/**
 * @ignore
 */
export const acknowledgeTask = async ({
  taskId,
  queue,
  client,
  ttl = 1000,
}: {
  taskId: string;
  queue: string;
  client: Redis;
  ttl?: number;
}) => {
  const taskStalledKey = getTaskAcknowledgedKey({ taskId, queue });
  await set({
    key: taskStalledKey,
    value: addByMsToISO(ttl),
    ttl,
    client,
  });
  return true;
};

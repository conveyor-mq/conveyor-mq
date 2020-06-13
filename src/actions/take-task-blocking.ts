import { Redis } from 'ioredis';
import { brpoplpush } from '../utils/redis';
import { getQueuedListKey, getProcessingListKey } from '../utils/keys';

/**
 * @ignore
 */
export const takeTaskBlocking = async ({
  timeout = 0,
  queue,
  client,
}: {
  timeout?: number;
  queue: string;
  client: Redis;
}): Promise<string | null> => {
  const taskId = await brpoplpush({
    fromKey: getQueuedListKey({ queue }),
    toKey: getProcessingListKey({ queue }),
    timeout,
    client,
  });
  return taskId;
};

import { Redis } from 'ioredis';
import {
  getFailedListKey,
  getProcessingListKey,
  getQueuedListKey,
  getScheduledSetKey,
  getStallingHashKey,
  getSuccessListKey,
} from '../utils/keys';
import { exec } from '../utils/redis';

/**
 * @ignore
 */
// TODO: Remove tasks.
export const destroyQueue = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const multi = client.multi();
  const keysToDelete = [
    getScheduledSetKey({ queue }),
    getQueuedListKey({ queue }),
    getProcessingListKey({ queue }),
    getStallingHashKey({ queue }),
    getSuccessListKey({ queue }),
    getFailedListKey({ queue }),
  ];
  keysToDelete.forEach((key) => {
    multi.del(key);
  });
  await exec(multi);
};

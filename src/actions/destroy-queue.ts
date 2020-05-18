import { Redis } from 'ioredis';
import { forEach } from 'lodash';
import {
  getQueuedListKey,
  getProcessingListKey,
  getSuccessListKey,
  getFailedListKey,
  getStallingHashKey,
  getScheduledSetKey,
} from '../utils/keys';
import { exec } from '../utils/redis';

/**
 * @ignore
 */
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
  forEach(keysToDelete, (key) => {
    multi.del(key);
  });
  await exec(multi);
};

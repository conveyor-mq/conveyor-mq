import { Redis } from 'ioredis';
import { exec } from '../utils/redis';
import {
  getQueuePausedKey,
  getQueuedListKey,
  getPausedListKey,
} from '../utils/keys';

/**
 * @ignore
 */
export const pauseQueue = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const multi = client.multi();
  multi.set(getQueuePausedKey({ queue }), 'true');
  multi.rename(getQueuedListKey({ queue }), getPausedListKey({ queue }));
  await exec(multi);
};

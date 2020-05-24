import { Redis } from 'ioredis';
import { exec } from '../utils/redis';
import {
  getQueuePausedKey,
  getQueuedListKey,
  getPausedListKey,
} from '../utils/keys';

export const resumeQueue = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const multi = client.multi();
  multi.set(getQueuePausedKey({ queue }), 'false');
  multi.rename(getPausedListKey({ queue }), getQueuedListKey({ queue }));
  await exec(multi);
};

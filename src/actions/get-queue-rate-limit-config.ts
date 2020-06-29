import { Redis } from 'ioredis';
import { get } from '../utils/redis';
import { getQueueRateLimitKey } from '../utils/keys';

export interface QueueRateLimitConfig {
  points: number;
  duration: number;
}

export const getQueueRateLimitConfig = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const rateLimitString = await get({
    key: getQueueRateLimitKey({ queue }),
    client,
  });
  if (!rateLimitString) {
    return null;
  }
  return JSON.parse(rateLimitString) as QueueRateLimitConfig;
};

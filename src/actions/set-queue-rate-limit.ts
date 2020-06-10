import { Redis } from 'ioredis';
import { set } from '../utils/redis';
import { getQueueRateLimitKey } from '../utils/keys';

export const setQueueRateLimit = async ({
  amount,
  interval,
  queue,
  client,
}: {
  amount: number;
  interval: number;
  queue: string;
  client: Redis;
}) => {
  await set({
    key: getQueueRateLimitKey({ queue }),
    value: JSON.stringify({ amount, interval }),
    client,
  });
};

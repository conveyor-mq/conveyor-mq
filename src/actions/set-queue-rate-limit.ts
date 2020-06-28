import { Redis } from 'ioredis';
import { exec } from '../utils/redis';
import {
  getQueueRateLimitKey,
  getQueueRateLimitUpdatedChannel,
} from '../utils/keys';
import { EventType } from '../domain/events/event-type';
import { serializeEvent } from '../domain/events/serialize-event';

export const setQueueRateLimit = async ({
  points,
  duration,
  queue,
  client,
}: {
  points: number;
  duration: number;
  queue: string;
  client: Redis;
}) => {
  const multi = client.multi();
  multi.set(
    getQueueRateLimitKey({ queue }),
    JSON.stringify({ points, duration }),
  );
  multi.publish(
    getQueueRateLimitUpdatedChannel({ queue }),
    serializeEvent({
      type: EventType.QueueRateLimitUpdated,
      createdAt: new Date(),
      data: { rateLimitConfig: { points, duration } },
    }),
  );
  await exec(multi);
};

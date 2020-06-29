import { Redis } from 'ioredis';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';
import { setQueueRateLimit } from '../../actions/set-queue-rate-limit';
import { getQueueRateLimitConfig } from '../../actions/get-queue-rate-limit-config';

describe('setQueueRateLimit', () => {
  const queue = createUuid();
  let client: Redis;

  beforeAll(() => {
    client = createClientAndLoadLuaScripts(redisConfig);
  });

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('setQueueRateLimit sets queue rate limit', async () => {
    const rateLimitConfig = { points: 100, duration: 60 };
    await setQueueRateLimit({
      points: rateLimitConfig.points,
      duration: rateLimitConfig.duration,
      queue,
      client,
    });
    const fetchedRateLimitConfig = await getQueueRateLimitConfig({
      queue,
      client,
    });
    expect(fetchedRateLimitConfig?.duration).toBe(rateLimitConfig.duration);
    expect(fetchedRateLimitConfig?.points).toBe(rateLimitConfig.points);
  });
});

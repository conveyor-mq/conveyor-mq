import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { createWorker } from '../../actions/create-worker';
import { getWorkers } from '../../actions/get-workers';
import { redisConfig } from '../config';

describe('getWorkers', () => {
  const queue = createUuid();
  let client: Redis;

  beforeAll(async () => {
    client = await createClient(redisConfig);
  });

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('getWorkers gets workers', async () => {
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
    });
    const worker2 = await createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
    });

    const workers = await getWorkers({ queue, client });
    expect(workers.length).toBe(2);
    expect(workers[0].id).not.toBe(null);
    expect(workers[1].id).not.toBe(null);
    await worker.shutdown();
    await worker2.shutdown();
  });
});

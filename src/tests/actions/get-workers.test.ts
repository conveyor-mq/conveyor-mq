import { Redis } from 'ioredis';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { createWorker } from '../../actions/create-worker';
import { getWorkers } from '../../actions/get-workers';
import { redisConfig } from '../config';

describe('getWorkers', () => {
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

  it('getWorkers gets workers', async () => {
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
    });
    await worker.onReady();
    const worker2 = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
    });
    await worker2.onReady();

    const workers = await getWorkers({ queue, client });
    expect(workers.length).toBe(2);
    expect(workers[0].id).not.toBe(null);
    expect(workers[1].id).not.toBe(null);
    await worker.shutdown();
    await worker2.shutdown();
  });
});

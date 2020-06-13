import { Redis } from 'ioredis';
import { isTaskStalled } from '../../actions/is-task-stalled';
import { acknowledgeTask } from '../../actions/acknowledge-task';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { redisConfig } from '../config';

describe('acknowledgeTask', () => {
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

  it('acknowledgeTask acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task, client });
    await takeTaskAndMarkAsProcessing({ queue, client, stallTimeout: 1 });
    await sleep(50);
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(true);
    await acknowledgeTask({ taskId: task.id, queue, client, ttl: 50 });
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(false);
    await sleep(50);
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(true);
    await acknowledgeTask({ taskId: task.id, queue, client });
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(false);
  });
});

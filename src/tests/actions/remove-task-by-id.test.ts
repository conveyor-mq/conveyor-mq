import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';
import {
  getQueuedListKey,
  getTaskKey,
  getProcessingListKey,
} from '../../utils/keys';
import { enqueueTask } from '../../actions/enqueue-task';
import { removeTaskById } from '../../actions/remove-task-by-id';
import { takeTask } from '../../actions/take-task';

describe('removeTaskById', () => {
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

  it('removeTaskById removes queued task', async () => {
    const task = { id: '2', data: 'c' };
    await enqueueTask({ queue, task, client });
    expect(await client.exists(getTaskKey({ taskId: task.id, queue }))).toBe(1);
    expect(await client.llen(getQueuedListKey({ queue }))).toBe(1);
    await removeTaskById({ taskId: task.id, queue, client });
    expect(await client.exists(getTaskKey({ taskId: task.id, queue }))).toBe(0);
    expect(await client.llen(getQueuedListKey({ queue }))).toBe(0);
  });
  it('removeTaskById removes processing task', async () => {
    const task = { id: '2', data: 'c' };
    await enqueueTask({ queue, task, client });
    await takeTask({ queue, client });
    expect(await client.exists(getTaskKey({ taskId: task.id, queue }))).toBe(1);
    expect(await client.llen(getProcessingListKey({ queue }))).toBe(1);
    await removeTaskById({ taskId: task.id, queue, client });
    expect(await client.exists(getTaskKey({ taskId: task.id, queue }))).toBe(0);
    expect(await client.llen(getProcessingListKey({ queue }))).toBe(0);
  });
});

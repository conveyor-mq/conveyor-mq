import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTask } from '../../actions/take-task';
import { isTaskStalled } from '../../actions/is-task-stalled';
import { flushAll, quit, lrange, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { getQueuedListKey, getProcessingListKey } from '../../utils/keys';
import { redisConfig } from '../config';
import { TaskStatus } from '../../domain/tasks/task-status';

describe('takeTask', () => {
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

  it('takeTask takes task off a queue and returns task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, client, task });
    const processingTask = await takeTask({ queue, client });
    expect(processingTask).toHaveProperty('id', task.id);
    expect(processingTask).toHaveProperty('status', TaskStatus.Processing);

    const queuedTaskIds = await lrange({
      key: getQueuedListKey({ queue }),
      start: 0,
      stop: -1,
      client,
    });
    expect(queuedTaskIds.length).toBe(0);

    const processingTaskIds = await lrange({
      key: getProcessingListKey({ queue }),
      start: 0,
      stop: -1,
      client,
    });
    expect(processingTaskIds.length).toBe(1);

    expect(await takeTask({ queue, client })).toBe(null);
  });
  it('takeTask acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, client, task });
    await takeTask({ queue, client });
    const isStalled = await isTaskStalled({ taskId: task.id, queue, client });
    expect(isStalled).toBe(false);
  });
  it('takeTask returns null when there is no task to take', async () => {
    const task = await takeTask({ queue, client });
    expect(task).toBe(null);
  });
});

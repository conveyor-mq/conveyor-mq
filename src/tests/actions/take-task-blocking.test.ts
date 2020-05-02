import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { TaskStatuses } from '../../domain/task-statuses';
import { takeTask } from '../../actions/take-task';
import { takeTaskBlocking } from '../../actions/take-task-blocking';
import { isTaskStalled } from '../../actions/is-task-stalled';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';

describe('takeTaskBlocking', () => {
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

  it('takeTaskBlocking takes task off a queue and returns task', async () => {
    const task = { id: 'e', data: 'f' };
    await enqueueTask({ queue, client, task });
    const processingTask = await takeTaskBlocking({ queue, client });
    await expect(processingTask).toHaveProperty('id', task.id);
    await expect(processingTask).toHaveProperty(
      'status',
      TaskStatuses.Processing,
    );
    expect(await takeTask({ queue, client })).toBe(null);
  });
  it('takeTaskBlocking acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, client, task });
    await takeTaskBlocking({ queue, client });
    const isStalled = await isTaskStalled({ taskId: task.id, queue, client });
    expect(isStalled).toBe(false);
  });
  it('takeTaskBlocking returns null after timeout when there is no task to take', async () => {
    const blockingClient = client.duplicate();
    const task = await takeTaskBlocking({
      queue,
      client: blockingClient,
      timeout: 1,
    });
    expect(task).toBe(null);
  });
});

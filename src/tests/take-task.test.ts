/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import { putTask } from '../actions/put-task';
import { TaskStatuses } from '../domain/task-statuses';
import { takeTask } from '../actions/take-task';
import { isTaskStalled } from '../actions/is-task-stalled';
import { flushAll, quit } from '../utils/redis';
import { createUuid } from '../utils/general';

describe('takeTask', () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('takeTask takes task off a queue and returns task', async () => {
    const task = { id: 'b', data: 'c' };
    await putTask({ queue, client, task });
    const processingTask = await takeTask({ queue, client });
    await expect(processingTask).toHaveProperty('id', task.id);
    await expect(processingTask).toHaveProperty(
      'status',
      TaskStatuses.Processing,
    );
    expect(await takeTask({ queue, client })).toBe(null);
  });
  it('takeTask acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await putTask({ queue, client, task });
    await takeTask({ queue, client });
    const isStalled = await isTaskStalled({ taskId: task.id, queue, client });
    expect(isStalled).toBe(false);
  });
  it('takeTask returns null when there is no task to take', async () => {
    const task = await takeTask({ queue, client });
    await expect(task).toBe(null);
  });
});

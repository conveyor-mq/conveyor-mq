import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTask } from '../../actions/take-task';
import { markTaskFailed } from '../../actions/mark-task-failed';
import { flushAll, quit, createClient, lrange } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { TaskStatuses } from '../../domain/tasks/task-statuses';
import { getTaskById } from '../../actions/get-task-by-id';
import { getFailedListKey } from '../../utils/keys';

describe('markTaskFailed', () => {
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

  it('markTaskFailed marks task failed', async () => {
    const task = { id: 'i', data: 'j' };
    await enqueueTask({ queue, client, task });
    const acquiredTask = (await takeTask({ queue, client })) as Task;
    const failedTask = await markTaskFailed({
      task: acquiredTask,
      queue,
      client,
      error: 'aww :(',
    });
    expect(failedTask).toHaveProperty('status', TaskStatuses.Failed);
    expect(failedTask).toHaveProperty('error', 'aww :(');

    const fetchedFailedTask = await getTaskById({
      taskId: task.id,
      queue,
      client,
    });
    expect(fetchedFailedTask).toHaveProperty('status', TaskStatuses.Failed);
    expect(fetchedFailedTask).toHaveProperty('error', 'aww :(');

    const failedTaskIds = await lrange({
      key: getFailedListKey({ queue }),
      start: 0,
      stop: -1,
      client,
    });
    expect(failedTaskIds.length).toBe(1);
    expect(failedTaskIds[0]).toBe(task.id);
  });
});

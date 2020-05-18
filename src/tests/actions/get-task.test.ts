import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { getTaskById } from '../../actions/get-task-by-id';
import { redisConfig } from '../config';
import { takeTask } from '../../actions/take-task';
import { Task } from '../../domain/tasks/task';
import { TaskStatuses } from '../../domain/tasks/task-statuses';

describe('getTask', () => {
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

  it('getTask gets tasks', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task, client });
    const retrievedTask = (await getTaskById({
      queue,
      client,
      taskId: task.id,
    })) as Task;
    expect(retrievedTask.id).toBe(task.id);
    expect(retrievedTask.status).toBe(TaskStatuses.Queued);

    await takeTask({ queue, client, stallTimeout: 100 });
    const retrievedTask2 = (await getTaskById({
      queue,
      client,
      taskId: task.id,
    })) as Task;
    expect(retrievedTask2.id).toBe(task.id);
    expect(retrievedTask2.status).toBe(TaskStatuses.Processing);
  });
  it('getTask returns null for missing task', async () => {
    const retrievedTask = (await getTaskById({
      queue,
      client,
      taskId: 'some-nonexistent-id',
    })) as Task | null;
    expect(retrievedTask).toBe(null);
  });
});

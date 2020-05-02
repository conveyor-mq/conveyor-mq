import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { createQueueManager } from '../../actions/create-queue-manager';
import { redisConfig } from '../config';
import { Task } from '../../domain/task';

describe('createQueueManager', () => {
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

  it('createQueueManager puts and gets task', async () => {
    const manager = await createQueueManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const retrievedTask = (await manager.getTask(task.id)) as Task;
    expect(retrievedTask.id).toBe(task.id);
    await manager.quit();
  });
  it('createQueueManager puts and gets tasks', async () => {
    const manager = await createQueueManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };
    await manager.enqueueTasks([taskA, taskB]);
    const [retrievedTaskA, retrievedTaskB] = await manager.getTasks([
      taskA.id,
      taskB.id,
    ]);
    expect(retrievedTaskA.id).toBe(taskA.id);
    expect(retrievedTaskB.id).toBe(taskB.id);
    await manager.quit();
  });
});

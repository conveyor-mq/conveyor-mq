import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { putTask } from '../../actions/put-task';
import { createQueueManager } from '../../actions/create-queue-manager';
import { redisConfig } from '../config';
import { TaskStatuses } from '../../domain/task-statuses';
import { getTask } from '../../actions/get-task';
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
    await manager.putTask({ task });
    const retrievedTask = (await manager.getTask({ taskId: task.id })) as Task;
    expect(retrievedTask.id).toBe(task.id);
  });
  it('createQueueManager puts and gets tasks', async () => {
    const manager = await createQueueManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };
    await manager.putTasks({ tasks: [taskA, taskB] });
    const [retrievedTaskA, retrievedTaskB] = await manager.getTasks({
      taskIds: [taskA.id, taskB.id],
    });
    expect(retrievedTaskA.id).toBe(taskA.id);
    expect(retrievedTaskB.id).toBe(taskB.id);
  });
});

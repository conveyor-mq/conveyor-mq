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

  it('createQueueManager creates manager', async () => {
    const manager = await createQueueManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const task = { id: 'b', data: 'c' };
    await manager.putTask({ task });
    const [retrievedTask] = await manager.getTasks({ taskIds: [task.id] });
    expect(retrievedTask.id).toBe(task.id);
  });
});

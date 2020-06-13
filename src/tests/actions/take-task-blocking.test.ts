import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { takeTaskBlocking } from '../../actions/take-task-blocking';
import { isTaskStalled } from '../../actions/is-task-stalled';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';
import { TaskStatus } from '../../domain/tasks/task-status';
import { markTaskProcessing } from '../../actions/mark-task-processing';

describe('takeTaskBlocking', () => {
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

  it('takeTaskBlocking takes task off a queue and returns task', async () => {
    const task = { id: 'e', data: 'f' };
    await enqueueTask({ queue, client, task });
    const taskId = (await takeTaskBlocking({
      queue,
      client,
    })) as string;
    const processingTask = await markTaskProcessing({
      taskId,
      queue,
      client,
      stallTimeout: 1000,
    });
    expect(processingTask).toHaveProperty('id', task.id);
    expect(processingTask).toHaveProperty('status', TaskStatus.Processing);
    expect(await takeTaskAndMarkAsProcessing({ queue, client })).toBe(null);
  });
  it('takeTaskBlocking acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, client, task });
    const taskId = (await takeTaskBlocking({ queue, client })) as string;
    await markTaskProcessing({ taskId, stallTimeout: 1000, queue, client });
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

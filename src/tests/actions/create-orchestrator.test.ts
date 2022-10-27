import RedisClient, { Redis } from 'ioredis';
import { createManager } from '../../actions/create-manager';
import { createOrchestrator } from '../../actions/create-orchestrator';
import { isTaskStalled } from '../../actions/is-task-stalled';
import { TaskStatus } from '../../domain/tasks/task-status';
import { loadLuaScripts } from '../../lua';
import { createUuid, sleep } from '../../utils/general';
import { getProcessingListKey, getQueuedListKey } from '../../utils/keys';
import {
  createClientAndLoadLuaScripts,
  flushAll,
  quit,
  rpoplpush,
} from '../../utils/redis';
import { redisConfig } from '../config';

describe('createOrchestrator', () => {
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

  it('createOrchestrator creates orchestrator', async () => {
    const orchestrator = createOrchestrator({ queue, redisConfig });
    await orchestrator.quit();
  });
  it('createOrchestrator enqueues scheduled task', async () => {
    const manager = createManager({ queue, redisConfig });
    const { task } = await manager.scheduleTask({
      data: 'hi',
      enqueueAfter: new Date(),
    });
    expect(task.status).toBe(TaskStatus.Scheduled);
    const orchestrator = createOrchestrator({
      queue,
      redisConfig,
      scheduledTasksCheckInterval: 10,
    });
    await sleep(30);
    expect((await manager.getTaskById(task.id))?.status).toBe(
      TaskStatus.Queued,
    );
    await orchestrator.quit();
    await manager.quit();
  });
  it('createOrchestrator marks orphaned task as processing', async () => {
    const manager = createManager({ queue, redisConfig });
    const { task } = await manager.enqueueTask({ data: 'hi' });
    expect(task.status).toBe(TaskStatus.Queued);
    const taskId = (await rpoplpush({
      client,
      fromKey: getQueuedListKey({ queue }),
      toKey: getProcessingListKey({ queue }),
    })) as string;
    expect(taskId).toBe(task.id);
    expect((await manager.getTaskById(task.id))?.status).toBe(
      TaskStatus.Queued,
    );
    expect(await isTaskStalled({ taskId, queue, client })).toBe(false);
    const orchestrator = createOrchestrator({
      queue,
      redisConfig,
      stalledCheckInterval: 5,
      defaultStallTimeout: 5,
    });
    await sleep(30);
    expect(await isTaskStalled({ taskId, queue, client })).toBe(true);
    await orchestrator.quit();
    await manager.quit();
  });
  it('createOrchestrator enqueues scheduled task using shared redis client', async () => {
    const redisClient = new RedisClient(redisConfig.port, redisConfig.host);
    const configuredRedisClient = loadLuaScripts({ client: redisClient });
    const manager = createManager({
      queue,
      redisConfig,
      redisClient: configuredRedisClient,
    });
    const { task } = await manager.scheduleTask({
      data: 'hi',
      enqueueAfter: new Date(),
    });
    expect(task.status).toBe(TaskStatus.Scheduled);
    const orchestrator = createOrchestrator({
      queue,
      redisClient: configuredRedisClient,
      scheduledTasksCheckInterval: 10,
    });
    await sleep(20);
    expect((await manager.getTaskById(task.id))?.status).toBe(
      TaskStatus.Queued,
    );
    await manager.quit();
    await orchestrator.quit();
  });
});

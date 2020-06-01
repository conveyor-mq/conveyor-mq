import { Redis } from 'ioredis';
import { map, forEach } from 'lodash';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid, sleep } from '../../utils/general';
import { createManager } from '../../actions/create-manager';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { createWorker } from '../../actions/create-worker';
import { TaskStatus } from '../../domain/tasks/task-status';
import { getQueuedListKey, getTaskKey } from '../../utils/keys';

describe('createManager', () => {
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

  it('createManager enqueues and gets task', async () => {
    const manager = createManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const task = { id: 'b', data: 'c' };
    const result = await manager.enqueueTask(task);
    expect(result.task.id).toBe(task.id);
    expect(result.task.status).toBe(TaskStatus.Queued);
    const retrievedTask = (await manager.getTaskById(task.id)) as Task;
    expect(retrievedTask.id).toBe(task.id);
    await manager.quit();
  });
  it('createManager enqueues and gets tasks', async () => {
    const manager = createManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };
    const [resultA, resultB] = await manager.enqueueTasks([taskA, taskB]);
    expect(resultA.task.id).toBe(taskA.id);
    expect(resultA.task.status).toBe(TaskStatus.Queued);
    expect(resultB.task.id).toBe(taskB.id);
    expect(resultB.task.status).toBe(TaskStatus.Queued);
    const [retrievedTaskA, retrievedTaskB] = await manager.getTasksById([
      taskA.id,
      taskB.id,
    ]);
    expect(retrievedTaskA.id).toBe(taskA.id);
    expect(retrievedTaskB.id).toBe(taskB.id);
    await manager.quit();
  });
  it('createManager onTaskComplete resolves', async () => {
    const manager = createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const worker = createWorker({
      queue,
      redisConfig,
      handler: async () => {
        return 'some-result';
      },
    });
    const completedTask = await manager.onTaskComplete(task.id);
    expect(completedTask.result).toBe('some-result');
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager onTaskComplete resolves later', async () => {
    const task = { id: 'b', data: 'c' };
    const worker = createWorker({
      queue,
      redisConfig,
      handler: async () => {
        return 'some-result';
      },
    });
    const manager = createManager({ queue, redisConfig });
    await manager.enqueueTask(task);
    await sleep(100);
    const completedTask = await manager.onTaskComplete(task.id);
    expect(completedTask.result).toBe('some-result');
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager multiple onTaskComplete resolve later', async () => {
    const worker = createWorker({
      queue,
      redisConfig,
      handler: async ({ task }) => {
        return task.id;
      },
    });
    const manager = createManager({ queue, redisConfig });
    const tasks = map(Array.from({ length: 10 }), (val, index) => ({
      id: `${index}a`,
    }));
    await manager.enqueueTasks(tasks);
    await sleep(100);
    const results = await Promise.all(
      map(tasks, (task) => manager.onTaskComplete(task.id)),
    );
    expect(results.length).toBe(tasks.length);
    forEach(results, (result, index) => {
      expect(result.id).toBe(tasks[index].id);
    });
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager getTaskCounts gets counts', async () => {
    const manager = createManager({ queue, redisConfig });
    await manager.enqueueTasks([{ data: 'a' }]);
    const { queuedCount, processingCount } = await manager.getTaskCounts();
    expect(queuedCount).toBe(1);
    expect(processingCount).toBe(0);
    await manager.quit();
  });
  it('createManager destroyQueue destroys queue', async () => {
    const manager = createManager({ queue, redisConfig });
    await manager.enqueueTasks([{ data: 'a' }]);
    expect(await client.exists(getQueuedListKey({ queue }))).toBe(1);
    await manager.destroyQueue();
    expect(await client.exists(getQueuedListKey({ queue }))).toBe(0);
    await manager.quit();
  });
  it('createManager removeTaskById removes task', async () => {
    const manager = createManager({ queue, redisConfig });
    const { task } = await manager.enqueueTask({ data: 'a' });
    expect(await client.llen(getQueuedListKey({ queue }))).toBe(1);
    expect(await client.exists(getTaskKey({ taskId: task.id, queue }))).toBe(1);
    await manager.removeTaskById(task.id);
    expect(await client.llen(getQueuedListKey({ queue }))).toBe(0);
    expect(await client.exists(getTaskKey({ taskId: task.id, queue }))).toBe(0);
    await manager.quit();
  });
  it('createManager getWorkers gets workers', async () => {
    const manager = createManager({ queue, redisConfig });
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
    });
    await worker.onReady();
    const workers = await manager.getWorkers();
    expect(workers.length).toBe(1);
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager pauses and resumes queue', async () => {
    const manager = createManager({ queue, redisConfig });
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
    });
    await manager.pauseQueue();
    const task = { id: 'task-id', data: 'x' };
    await manager.enqueueTask(task);

    await sleep(50);
    expect(await manager.getTaskById(task.id)).toHaveProperty(
      'status',
      TaskStatus.Queued,
    );

    await manager.resumeQueue();

    await sleep(50);
    expect(await manager.getTaskById(task.id)).toHaveProperty(
      'status',
      TaskStatus.Success,
    );

    await manager.quit();
    await worker.shutdown();
  });
});

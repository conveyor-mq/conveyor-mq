import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid, sleep } from '../../utils/general';
import { createManager } from '../../actions/create-manager';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { createWorker } from '../../actions/create-worker';
import { Event } from '../../domain/events/event';

describe('createManager', () => {
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

  it('createManager enqueues and gets task', async () => {
    const manager = await createManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
    const retrievedTask = (await manager.getTask(task.id)) as Task;
    expect(retrievedTask.id).toBe(task.id);
    await manager.quit();
  });
  it('createManager enqueues and gets tasks', async () => {
    const manager = await createManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };
    await manager.enqueueTasks([{ task: taskA }, { task: taskB }]);
    const [retrievedTaskA, retrievedTaskB] = await manager.getTasks([
      taskA.id,
      taskB.id,
    ]);
    expect(retrievedTaskA.id).toBe(taskA.id);
    expect(retrievedTaskB.id).toBe(taskB.id);
    await manager.quit();
  });
  it('createManager enqueueTasks calls onTaskComplete', async () => {
    const manager = await createManager({ queue, redisConfig });
    expect(typeof manager.quit).toBe('function');
    const taskA = { id: 'a', data: 'c' };
    const promise = new Promise((resolve) => {
      manager.enqueueTasks([
        { task: taskA, onTaskComplete: ({ event }) => resolve(event) },
      ]);
    }) as Promise<Event>;
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'some result',
    });
    const event = await promise;
    expect(typeof event.createdAt).toBe('object');
    expect(event?.task?.id).toBe(taskA.id);
    expect(event?.task?.data).toBe(taskA.data);
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager enqueueTask calls onTaskComplete', async () => {
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    const promise = new Promise((resolve) => {
      manager.enqueueTask({
        task,
        onTaskComplete: ({ event }) => resolve(event),
      });
    }) as Promise<Event>;
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'some result',
    });
    const event = await promise;
    expect(typeof event.createdAt).toBe('object');
    expect(event?.task?.id).toBe(task.id);
    expect(event?.task?.data).toBe(task.data);
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager onTaskComplete resolves', async () => {
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: async () => {
        return 'some-result';
      },
    });
    const completedTask = await manager.onTaskComplete({ taskId: task.id });
    expect(completedTask.result).toBe('some-result');
    await manager.quit();
    await worker.shutdown();
  });
  it('createManager onTaskComplete resolves later', async () => {
    const task = { id: 'b', data: 'c' };
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: async () => {
        return 'some-result';
      },
    });
    const manager = await createManager({ queue, redisConfig });
    await manager.enqueueTask({ task });
    await sleep(100);
    const completedTask = await manager.onTaskComplete({ taskId: task.id });
    expect(completedTask.result).toBe('some-result');
    await manager.quit();
    await worker.shutdown();
  });
});

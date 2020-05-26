import { Redis } from 'ioredis';
import moment from 'moment';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid, sleep } from '../../utils/general';
import { createManager } from '../../actions/create-manager';
import { redisConfig } from '../config';
import { createListener } from '../../actions/create-listener';
import { EventType } from '../../domain/events/event-type';
import { TaskStatus } from '../../domain/tasks/task-status';
import { createWorker } from '../../actions/create-worker';
import { takeTask } from '../../actions/take-task';
import { processStalledTasks } from '../../actions/process-stalled-tasks';
import { updateTask } from '../../actions/update-task';
import { Task } from '../../domain/tasks/task';

describe('createListener', () => {
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

  it('createListener listens for task queued event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskQueued, ({ event }) => {
        resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Queued);
  });
  it('createListener listens for task scheduled event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskScheduled, ({ event }) => {
        resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = {
      id: 'b',
      data: 'c',
      enqueueAfter: moment().add(1, 'hours').toDate(),
    };
    await manager.scheduleTask(task);
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Scheduled);
  });
  it('createListener listens for task processing event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskProcessing, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'done',
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Processing);
    await worker.shutdown();
  });
  it('createListener listens for task success event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskSuccess, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'done',
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Success);
    await worker.shutdown();
  });
  it('createListener listens for task error event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskError, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => {
        throw new Error('some-error');
      },
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Processing);
    await worker.shutdown();
  });
  it('createListener listens for task failed event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskFail, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task: Task = { id: 'b', data: 'c', retryLimit: 0 };
    await manager.enqueueTask(task);
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => {
        throw new Error('some-error');
      },
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Failed);
    await worker.shutdown();
  });
  it('createListener listens for task error event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskError, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => {
        throw new Error('some-error');
      },
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Processing);
    await worker.shutdown();
  });
  it('createListener listens for task stalled event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskStalled, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task: Task = { id: 'b', data: 'c', stallRetryLimit: 1 };
    await manager.enqueueTask(task);

    await takeTask({ queue, client, stallTimeout: 1 });
    await sleep(50);
    await processStalledTasks({ queue, client });

    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatus.Processing);
  });
  it('createListener listens for task updated event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskUpdated, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    const { task: enqueuedTask } = await manager.enqueueTask(task);

    await updateTask({
      taskId: enqueuedTask.id,
      taskUpdateData: { data: 'b' },
      queue,
      client,
    });

    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', 'b');
    expect(event).toHaveProperty('task.status', TaskStatus.Queued);
  });
  it('createListener listens for task progress updated event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskProgressUpdated, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask(task);

    const worker = await createWorker({
      queue,
      redisConfig,
      handler: async ({ updateTaskProgress }) => {
        await updateTaskProgress(1);
      },
    });

    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.progress', 1);
    expect(event).toHaveProperty('task.status', TaskStatus.Processing);
    await manager.quit();
    await worker.shutdown();
  });
});

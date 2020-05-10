import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid, sleep } from '../../utils/general';
import { createManager } from '../../actions/create-manager';
import { redisConfig } from '../config';
import { createListener } from '../../actions/create-listener';
import { EventTypes } from '../../domain/events/event-types';
import { TaskStatuses } from '../../domain/tasks/task-statuses';
import { createWorker } from '../../actions/create-worker';
import { takeTask } from '../../actions/take-task';
import { processStalledTasks } from '../../actions/process-stalled-tasks';
import { updateTask } from '../../actions/update-task';

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
      listener.on(EventTypes.TaskQueued, ({ event }) => {
        resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatuses.Queued);
  });
  it('createListener listens for task processing event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskProcessing, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'done',
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatuses.Processing);
    // TODO: Fix race condition.
    await sleep(50);
    await worker.shutdown();
  });
  it('createListener listens for task success event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskSuccess, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => 'done',
    });
    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatuses.Success);
    // TODO: Fix race condition.
    await sleep(50);
    await worker.shutdown();
  });
  it('createListener listens for task error event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskError, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
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
    expect(event).toHaveProperty('task.status', TaskStatuses.Processing);
    // TODO: Fix race condition.
    await sleep(50);
    await worker.shutdown();
  });
  it('createListener listens for task failed event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskFail, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
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
    expect(event).toHaveProperty('task.status', TaskStatuses.Failed);
    // TODO: Fix race condition.
    await sleep(50);
    await worker.shutdown();
  });
  it('createListener listens for task error event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskError, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });
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
    expect(event).toHaveProperty('task.status', TaskStatuses.Processing);
    // TODO: Fix race condition.
    await sleep(50);
    await worker.shutdown();
  });
  it('createListener listens for task stalled event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskStalled, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    await manager.enqueueTask({ task });

    await takeTask({ queue, client, stallDuration: 1 });
    await sleep(50);
    await processStalledTasks({ queue, client });

    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatuses.Processing);
  });
  it('createListener listens for task updated event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventTypes.TaskUpdated, ({ event }) => {
        return resolve(event);
      });
    });
    const manager = await createManager({ queue, redisConfig });
    const task = { id: 'b', data: 'c' };
    const { task: enqueuedTask } = await manager.enqueueTask({ task });

    await updateTask({ task: enqueuedTask, queue, client });

    const event = await promise;
    expect(event).toHaveProperty('task.id', task.id);
    expect(event).toHaveProperty('task.data', task.data);
    expect(event).toHaveProperty('task.status', TaskStatuses.Queued);
  });
});

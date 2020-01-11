/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import {
  putTask,
  getTask,
  TaskStatuses,
  takeTask,
  markTaskSuccess,
  markTaskFailed,
  takeTaskBlocking,
} from '.';
import { flushAll } from './utils';

describe('Tasks', () => {
  const client = redis.createClient({
    host: '127.0.0.1',
    port: 9004,
  });
  const queue = 'myQueue';

  beforeEach(async () => {
    await flushAll({ client });
  });

  it('putTask adds task to a queue', async () => {
    const task = {
      id: 'a',
      data: 'b',
    };
    const queuedTask = await putTask({ queue, client, task });
    const retrievedTask = await getTask({
      queue,
      taskId: task.id,
      client,
    });
    expect(task.data).toBe(queuedTask.data);
    expect(queuedTask.status).toBe(TaskStatuses.Queued);
    expect(task.data).toBe(retrievedTask!.data);
  });
  it('takeTask takes task off a queue and returns task', async () => {
    const task = {
      id: 'b',
      data: 'c',
    };
    await putTask({ queue, client, task });
    const acquireTaskPromise = takeTask({ queue, client });
    await expect(acquireTaskPromise).resolves.toHaveProperty('id', task.id);
    await expect(acquireTaskPromise).resolves.toHaveProperty(
      'status',
      TaskStatuses.Processing,
    );
    const retrievedTask = await takeTask({ queue, client });
    expect(retrievedTask).toBe(null);
  });
  it('takeTask returns null when there is no task to take', async () => {
    const acquireTaskPromise = takeTask({ queue, client });
    await expect(acquireTaskPromise).resolves.toBe(null);
  });
  it('takeTaskBlocking takes task off a queue and returns task', async () => {
    const task = {
      id: 'e',
      data: 'f',
    };
    await putTask({ queue, client, task });
    const acquireTaskPromise = takeTaskBlocking({ queue, client });
    await expect(acquireTaskPromise).resolves.toHaveProperty('id', task.id);
    await expect(acquireTaskPromise).resolves.toHaveProperty(
      'status',
      TaskStatuses.Processing,
    );
    const retrievedTask = await takeTask({ queue, client });
    expect(retrievedTask).toBe(null);
  });
  it('takeTaskBlocking returns null after timeout when there is no task to take', async () => {
    const blockingClient = client.duplicate();
    const acquireTaskPromise = takeTaskBlocking({
      queue,
      client: blockingClient,
      timeout: 1,
    });
    await expect(acquireTaskPromise).resolves.toBe(null);
  });
  it('markTaskSuccessful marks task successful', async () => {
    const task = {
      id: 'g',
      data: 'h',
    };
    await putTask({ queue, client, task });
    const acquiredTask = await takeTask({ queue, client });
    if (!acquiredTask) {
      expect(acquiredTask).toHaveProperty('id', task.id);
      return;
    }
    const successfulTask = await markTaskSuccess({
      task: acquiredTask,
      queue,
      client,
      result: 'horaay!',
    });
    expect(successfulTask).toHaveProperty('status', TaskStatuses.Success);
    expect(successfulTask).toHaveProperty('result', 'horaay!');
  });
  it('markTaskFailed marks task failed', async () => {
    const task = {
      id: 'i',
      data: 'j',
    };
    await putTask({ queue, client, task });
    const acquiredTask = await takeTask({ queue, client });
    if (!acquiredTask) {
      expect(acquiredTask).toHaveProperty('id', task.id);
      return;
    }
    const failedTask = await markTaskFailed({
      task: acquiredTask,
      queue,
      client,
      error: 'aww :(',
    });
    expect(failedTask).toHaveProperty('status', TaskStatuses.Failed);
    expect(failedTask).toHaveProperty('error', 'aww :(');
  });
});

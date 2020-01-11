/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import moment from 'moment';
import {
  putTask,
  getTask,
  TaskStatuses,
  takeTask,
  markTaskSuccess,
  markTaskFailed,
  takeTaskBlocking,
  Task,
  hasTaskExpired,
  handleTask,
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
  it('hasTaskExpired returns false for task with no expiresOn', () => {
    const thePast = moment('2020-01-01');
    const task: Task = {
      id: 'i',
      data: 'j',
    };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns false for not expired task', () => {
    const thePast = moment('2020-01-01');
    const theFuture = moment('2020-01-02');
    const task: Task = {
      id: 'i',
      expiresOn: theFuture,
      data: 'j',
    };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns true for expired task', () => {
    const thePast = moment('2020-01-01');
    const theFuture = moment('2020-01-02');
    const task: Task = {
      id: 'i',
      expiresOn: thePast,
      data: 'j',
    };
    expect(hasTaskExpired({ task, asOf: theFuture })).toBe(true);
  });
  it('handleTask returns null for expired task', async () => {
    const thePast = moment('2020-01-01');
    const theFuture = moment('2020-01-02');
    const expiredTask: Task = {
      id: 'i',
      expiresOn: thePast,
      data: 'j',
    };
    const result = await handleTask({
      queue,
      client,
      task: expiredTask,
      asOf: theFuture,
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
  });
  it('handleTask handles task success case', async () => {
    const now = moment('2020-01-02');
    const theTask: Task = {
      id: 'i',
      data: 'j',
    };
    const result = await handleTask({
      queue,
      client,
      task: theTask,
      asOf: now,
      handler: ({ task }: { task: Task }) => {
        expect(task.id).toBe(theTask.id);
        return 'some-result';
      },
    });
    const handledTask = await getTask({ queue, taskId: theTask.id, client });
    expect(result).toBe('some-result');
    expect(handledTask && handledTask.status).toBe(TaskStatuses.Success);
    expect(handledTask && handledTask.result).toBe('some-result');
    expect(handledTask && handledTask.error).toBe(undefined);
  });
  it('handleTask handles task failure case', async () => {
    const now = moment('2020-01-02');
    const theTask: Task = {
      id: 'i',
      data: 'j',
    };
    const result = await handleTask({
      queue,
      client,
      task: theTask,
      asOf: now,
      handler: () => {
        throw new Error('some-error');
      },
    });
    const handledTask = await getTask({ queue, taskId: theTask.id, client });
    expect(handledTask && handledTask.status).toBe(TaskStatuses.Failed);
    expect(handledTask && handledTask.error).toBe('some-error');
    expect(handledTask && handledTask.result).toBe(undefined);
  });
});

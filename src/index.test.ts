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
  registerHandler,
} from '.';
import { flushAll, createUuid, sleep } from './utils';

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
    const task: Task = {
      id: 'a',
      data: 'b',
    };
    const queuedTask = await putTask({ queue, client, task });
    expect(queuedTask.data).toBe(task.data);
    expect(typeof queuedTask.queuedOn).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedOn).toBe(undefined);
    expect(queuedTask.processingEndedOn).toBe(undefined);
    expect(queuedTask.status).toBe(TaskStatuses.Queued);
    expect(queuedTask.data).toBe(task.data);
  });
  it('putTask resets processing dates', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      queuedOn: moment(),
      processingStartedOn: moment(),
      processingEndedOn: moment(),
    };
    const queuedTask = await putTask({ queue, client, task });
    expect(typeof queuedTask.queuedOn).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedOn).toBe(undefined);
    expect(queuedTask.processingEndedOn).toBe(undefined);
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
      asOf: moment(),
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
      asOf: moment(),
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
    expect(hasTaskExpired({ task: expiredTask, asOf: theFuture }));
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
        expect(task.attemptCount).toBe(1);
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
    await handleTask({
      queue,
      client,
      task: theTask,
      asOf: now,
      handler: ({ task }) => {
        expect(task.attemptCount).toBe(1);
        throw new Error('some-error');
      },
    });
    const handledTask = await getTask({ queue, taskId: theTask.id, client });
    expect(typeof handledTask!.processingStartedOn).toBe('object');
    expect(typeof handledTask!.processingEndedOn).toBe('object');
    expect(handledTask!.status).toBe(TaskStatuses.Failed);
    expect(handledTask!.error).toBe('some-error');
    expect(handledTask!.result).toBe(undefined);
  });
  it('handleTask retires task', async () => {
    const now = moment('2020-01-02');
    const theTask: Task = {
      id: 'i',
      data: 'j',
      maxAttempts: 2,
    };
    await handleTask({
      queue,
      client,
      task: theTask,
      asOf: now,
      handler: ({ task }) => {
        expect(task.attemptCount).toBe(1);
        throw new Error('some-error');
      },
    });
    const handledTask = await getTask({ queue, taskId: theTask.id, client });
    if (handledTask === null) {
      expect(handledTask).not.toBe(null);
    }
    expect(handledTask!.attemptCount).toBe(1);
    expect(handledTask!.status).toBe(TaskStatuses.Queued);
    expect(handledTask!.error).toBe(undefined);
    expect(handledTask!.result).toBe(undefined);
    await expect(takeTask({ queue, client })).resolves.toHaveProperty(
      'id',
      theTask.id,
    );
    await handleTask({
      queue,
      client,
      task: handledTask!,
      asOf: now,
      handler: ({ task }) => {
        expect(task.attemptCount).toBe(2);
        throw new Error('some-error');
      },
    });
    const handledTask2 = await getTask({ queue, taskId: theTask.id, client });
    if (handledTask2 === null) {
      expect(handledTask2).not.toBe(null);
    }
    expect(handledTask2!.attemptCount).toBe(2);
    expect(handledTask2!.status).toBe(TaskStatuses.Failed);
    expect(handledTask2!.error).toBe('some-error');
    expect(handledTask2!.result).toBe(undefined);
    await expect(takeTask({ queue, client })).resolves.toBe(null);
  });
  describe('Task', () => {
    it('Handles successful task', async () => {
      const handlerClient = client.duplicate();
      registerHandler({
        queue,
        client: handlerClient,
        handler: async ({ task }: { task?: Task }) => {
          await expect(task!.status).toBe(TaskStatuses.Processing);
          await expect(task!.attemptCount).toBe(1);
          return 'some-task-result';
        },
      });

      const task: Task = {
        id: createUuid(),
        data: 'some-task-data',
        maxAttempts: 1,
      };
      await putTask({ queue, client, task });

      await sleep(50);
      const completedTask = await getTask({ queue, taskId: task.id, client });
      await expect(completedTask!.status).toBe(TaskStatuses.Success);
      await expect(completedTask!.result).toBe('some-task-result');
      await expect(completedTask!.error).toBe(undefined);
    });
    it.skip('Handles failed task', async () => {
      const handlerClient = client.duplicate();
      registerHandler({
        queue,
        client: handlerClient,
        handler: async ({ task }: { task?: Task }) => {
          await expect(task!.status).toBe(TaskStatuses.Processing);
          await expect(task!.attemptCount).toBe(1);
          throw new Error('some-error');
        },
      });

      const task: Task = {
        id: createUuid(),
        data: 'some-task-data',
        maxAttempts: 0,
      };
      await putTask({ queue, client, task });

      await sleep(50);
      const completedTask = await getTask({ queue, taskId: task.id, client });
      await expect(completedTask!.status).toBe(TaskStatuses.Failed);
      await expect(completedTask!.result).toBe(undefined);
      await expect(completedTask!.error).toBe('some-error');
    });
  });
});

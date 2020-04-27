import moment from 'moment';
import { Redis } from 'ioredis';
import { Task } from '../../domain/task';
import { putTask } from '../../actions/put-task';
import { TaskStatuses } from '../../domain/task-statuses';
import { takeTask } from '../../actions/take-task';
import { hasTaskExpired } from '../../actions/has-task-expired';
import { handleTask } from '../../actions/handle-task';
import { getTask } from '../../actions/get-task';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';

describe('handleTask', () => {
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

  it('handleTask returns null for expired task', async () => {
    console.warn = jest.fn();
    const thePast = moment('2020-01-01');
    const theFuture = moment('2020-01-02');
    const expiredTask: Task = { id: 'i', expiresOn: thePast, data: 'j' };
    expect(hasTaskExpired({ task: expiredTask, asOf: theFuture })).toBe(true);
    const result = await handleTask({
      queue,
      client,
      task: expiredTask,
      asOf: theFuture,
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
    expect(console.warn).toHaveBeenCalled();
  });
  it('handleTask returns null for attempt count exceeded', async () => {
    console.warn = jest.fn();
    const task: Task = {
      id: 'i',
      data: 'j',
      maxAttemptCount: 2,
      attemptCount: 3,
    };
    const result = await handleTask({
      queue,
      client,
      task,
      asOf: moment(),
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
    expect(console.warn).toHaveBeenCalled();
  });
  it('handleTask returns null for error count exceeded', async () => {
    console.warn = jest.fn();
    const task: Task = {
      id: 'i',
      data: 'j',
      maxErrorCount: 1,
      errorCount: 2,
    };
    const result = await handleTask({
      queue,
      client,
      task,
      asOf: moment(),
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
    expect(console.warn).toHaveBeenCalled();
  });
  it('handleTask handles task success case', async () => {
    const now = moment('2020-01-02');
    const theTask: Task = { id: 'i', data: 'j' };
    await putTask({ queue, task: theTask, client });
    const processingTask = (await takeTask({ queue, client })) as Task;
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onFailure = jest.fn();
    const result = await handleTask({
      queue,
      client,
      task: processingTask,
      asOf: now,
      onTaskSuccess: onSuccess,
      onTaskError: onError,
      onTaskFailed: onFailure,
      handler: ({ task }: { task: Task }) => {
        expect(task.attemptCount).toBe(1);
        expect(task.id).toBe(theTask.id);
        return 'some-result';
      },
    });
    const handledTask = (await getTask({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(result).toBe('some-result');
    expect(handledTask.status).toBe(TaskStatuses.Success);
    expect(handledTask.result).toBe('some-result');
    expect(handledTask.error).toBe(undefined);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onFailure).toHaveBeenCalledTimes(0);
  });
  it('handleTask handles task failure case', async () => {
    const now = moment('2020-01-02');
    const theTask: Task = { id: 'i', data: 'j' };
    await putTask({ queue, task: theTask, client });
    const processingTask = (await takeTask({ queue, client })) as Task;
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onFailure = jest.fn();
    await handleTask({
      queue,
      client,
      task: processingTask,
      asOf: now,
      onTaskSuccess: onSuccess,
      onTaskError: onError,
      onTaskFailed: onFailure,
      handler: ({ task }) => {
        expect(task.attemptCount).toBe(1);
        throw new Error('some-error');
      },
    });
    const handledTask = (await getTask({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(typeof handledTask.processingStartedOn).toBe('object');
    expect(typeof handledTask.processingEndedOn).toBe('object');
    expect(handledTask.status).toBe(TaskStatuses.Failed);
    expect(handledTask.error).toBe('some-error');
    expect(handledTask.result).toBe(undefined);
    expect(onSuccess).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
  it('handleTask retires errored task', async () => {
    const now = moment('2020-01-02');
    const task: Task = { id: 'i', data: 'j', maxAttemptCount: 2 };
    await putTask({ queue, task, client });
    const processingTask = (await takeTask({ queue, client })) as Task;
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onFailure = jest.fn();
    await handleTask({
      queue,
      client,
      task: processingTask,
      asOf: now,
      getRetryDelay: () => 0,
      onTaskSuccess: onSuccess,
      onTaskError: onError,
      onTaskFailed: onFailure,
      handler: ({ task: taskToHandle }) => {
        expect(taskToHandle.attemptCount).toBe(1);
        throw new Error('some-error');
      },
    });
    expect(onSuccess).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(0);

    const handledTask = (await getTask({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(handledTask.attemptCount).toBe(2);
    expect(handledTask.status).toBe(TaskStatuses.Queued);
    expect(handledTask.error).toBe(undefined);
    expect(handledTask.result).toBe(undefined);

    await expect(takeTask({ queue, client })).resolves.toHaveProperty(
      'id',
      task.id,
    );
    await handleTask({
      queue,
      client,
      task: handledTask,
      asOf: now,
      getRetryDelay: () => 0,
      handler: ({ task: taskToHandle }) => {
        expect(taskToHandle.attemptCount).toBe(2);
        throw new Error('some-error');
      },
    });
    const handledTask2 = (await getTask({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(handledTask2.attemptCount).toBe(2);
    expect(handledTask2.status).toBe(TaskStatuses.Failed);
    expect(handledTask2.error).toBe('some-error');
    expect(handledTask2.result).toBe(undefined);
    expect(await takeTask({ queue, client })).toBe(null);
  });
});
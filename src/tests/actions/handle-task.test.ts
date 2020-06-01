import moment from 'moment';
import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTask } from '../../actions/take-task';
import { hasTaskExpired } from '../../actions/has-task-expired';
import { handleTask } from '../../actions/handle-task';
import { getTaskById } from '../../actions/get-task-by-id';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
  lrange,
} from '../../utils/redis';
import { createUuid, sleep } from '../../utils/general';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { TaskStatus } from '../../domain/tasks/task-status';
import { getProcessingListKey } from '../../utils/keys';

describe('handleTask', () => {
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

  it('handleTask fails task if task is expired', async () => {
    const thePast = moment('2020-01-01').toDate();
    const theFuture = moment('2020-01-02').toDate();
    const expiredTask: Task = { id: 'i', expiresAt: thePast, data: 'j' };
    expect(hasTaskExpired({ task: expiredTask, asOf: theFuture })).toBe(true);
    await enqueueTask({ task: expiredTask, queue, client });
    const takenTask = (await takeTask({ queue, client })) as Task;
    const onTaskFailed = jest.fn();
    const result = await handleTask({
      queue,
      client,
      task: takenTask,
      asOf: theFuture,
      onTaskFailed,
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
    const failedTask = (await getTaskById({
      queue,
      taskId: takenTask.id,
      client,
    })) as Task;
    expect(failedTask.id).toBe(takenTask.id);
    expect(failedTask.status).toBe(TaskStatus.Failed);
    expect(failedTask.error).toBe('Task has expired');
    expect(onTaskFailed).toBeCalledTimes(1);
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);
  });
  it('handleTask fails task if retry limit exceeded', async () => {
    const task: Task = {
      id: 'i',
      data: 'j',
      retryLimit: 2,
      retries: 3,
    };
    const onTaskFailed = jest.fn();
    const result = await handleTask({
      queue,
      client,
      task,
      asOf: new Date(),
      onTaskFailed,
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
    const failedTask = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(failedTask.id).toBe(task.id);
    expect(failedTask.status).toBe(TaskStatus.Failed);
    expect(failedTask.error).toBe('Retry limit reached');
    expect(onTaskFailed).toBeCalledTimes(1);
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);
  });
  it('handleTask fails task if error retry exceeded', async () => {
    const task: Task = {
      id: 'i',
      data: 'j',
      errorRetryLimit: 1,
      errorRetries: 2,
    };
    const onTaskFailed = jest.fn();
    const result = await handleTask({
      queue,
      client,
      task,
      asOf: new Date(),
      onTaskFailed,
      handler: () => 'some-result',
    });
    expect(result).toBe(null);
    const failedTask = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(failedTask.id).toBe(task.id);
    expect(failedTask.status).toBe(TaskStatus.Failed);
    expect(failedTask.error).toBe('Error retry limit reached');
    expect(onTaskFailed).toBeCalledTimes(1);
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);
  });
  it('handleTask handles task success case', async () => {
    const now = moment('2020-01-02').toDate();
    const theTask: Task = { id: 'i', data: 'j' };
    await enqueueTask({ queue, task: theTask, client });
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
        expect(task.retries).toBe(0);
        expect(task.id).toBe(theTask.id);
        return 'some-result';
      },
    });
    const handledTask = (await getTaskById({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(result).toBe('some-result');
    expect(handledTask.status).toBe(TaskStatus.Success);
    expect(handledTask.result).toBe('some-result');
    expect(handledTask.error).toBe(undefined);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onFailure).toHaveBeenCalledTimes(0);
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);
  });
  it('handleTask handles task failure case', async () => {
    const now = moment('2020-01-02').toDate();
    const theTask: Task = { id: 'i', data: 'j', retryLimit: 0 };
    await enqueueTask({ queue, task: theTask, client });
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
      handler: ({ task }) => {
        expect(task.retries).toBe(0);
        throw new Error('some-error');
      },
    });
    expect(result).toBe(null);
    const handledTask = (await getTaskById({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(typeof handledTask.processingStartedAt).toBe('object');
    expect(typeof handledTask.processingEndedAt).toBe('object');
    expect(handledTask.status).toBe(TaskStatus.Failed);
    expect(handledTask.error).toBe('some-error');
    expect(handledTask.result).toBe(undefined);
    expect(onSuccess).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);
  });
  it('handleTask retries errored task', async () => {
    const now = moment('2020-01-02').toDate();
    const task: Task = { id: 'i', data: 'j', errorRetryLimit: 1 };
    await enqueueTask({ queue, task, client });
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
        expect(taskToHandle.retries).toBe(0);
        throw new Error('some-error');
      },
    });
    expect(onSuccess).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(0);
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);

    const handledTask = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(handledTask.retries).toBe(1);
    expect(handledTask.status).toBe(TaskStatus.Queued);
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
        expect(taskToHandle.retries).toBe(1);
        throw new Error('some-error');
      },
    });
    const handledTask2 = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(handledTask2.retries).toBe(1);
    expect(handledTask2.status).toBe(TaskStatus.Failed);
    expect(handledTask2.error).toBe('some-error');
    expect(handledTask2.result).toBe(undefined);
    expect(await takeTask({ queue, client })).toBe(null);
  });
  it('handleTask times out task with executionTimeout', async () => {
    const task: Task = {
      id: 'i',
      data: 'j',
      executionTimeout: 10,
      retryLimit: 0,
    };
    await enqueueTask({ queue, task, client });
    const taskToHandle = (await takeTask({ queue, client })) as Task;
    const result = await handleTask({
      queue,
      client,
      task: taskToHandle,
      asOf: new Date(),
      handler: async () => {
        await sleep(50);
        return 'some-result';
      },
    });
    expect(result).toBe(null);
    const failedTask = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(failedTask.id).toBe(task.id);
    expect(failedTask.status).toBe(TaskStatus.Failed);
    expect(failedTask.error).toBe(
      'Task execution duration exceeded executionTimeout',
    );
    const numberOfProcessingTasks = await lrange({
      start: 0,
      stop: -1,
      key: getProcessingListKey({ queue }),
      client,
    });
    expect(numberOfProcessingTasks.length).toBe(0);
  });
  it('handleTask updates task progress', async () => {
    const task: Task = {
      id: 'i',
      data: 'j',
    };
    await enqueueTask({ queue, task, client });
    const taskToHandle = (await takeTask({ queue, client })) as Task;
    const result = await handleTask({
      queue,
      client,
      task: taskToHandle,
      asOf: new Date(),
      handler: async ({ updateTaskProgress }) => {
        await updateTaskProgress(1);
        await updateTaskProgress(2);
        await updateTaskProgress(3);
        return 'some-result';
      },
    });
    expect(result).toBe('some-result');

    await sleep(50);
    const completedTask = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(completedTask.id).toBe(task.id);
    expect(completedTask.progress).toBe(3);
    expect(completedTask.status).toBe(TaskStatus.Success);
  });
  it('handleTask updateTask updates task', async () => {
    const task: Task = {
      id: 'i',
      data: 'j',
    };
    await enqueueTask({ queue, task, client });
    const taskToHandle = (await takeTask({ queue, client })) as Task;
    const result = await handleTask({
      queue,
      client,
      task: taskToHandle,
      asOf: new Date(),
      handler: async ({ updateTask }) => {
        await updateTask({ data: 'new data' });
        return 'some-result';
      },
    });
    expect(result).toBe('some-result');

    await sleep(50);
    const completedTask = (await getTaskById({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(completedTask.id).toBe(task.id);
    expect(completedTask.data).toBe('new data');
    expect(completedTask.status).toBe(TaskStatus.Success);
  });
});

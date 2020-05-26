import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { getTaskById } from '../../actions/get-task-by-id';
import { handleStalledTasks } from '../../actions/handle-stalled-tasks';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { TaskStatus } from '../../domain/tasks/task-status';

describe('handleStalledTasks', () => {
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

  it('handleStalledTasks retries stalled tasks', async () => {
    const taskToRequeue: Task = {
      id: 'a',
      data: 'c',
      retryLimit: 2,
    };
    await enqueueTask({ queue, task: taskToRequeue, client });

    const retrievedTaskToRequeue = (await getTaskById({
      queue,
      client,
      taskId: taskToRequeue.id,
    })) as Task;
    expect(retrievedTaskToRequeue.retries).toBe(0);
    expect(retrievedTaskToRequeue.stallRetries).toBe(0);
    expect(retrievedTaskToRequeue.retryLimit).toBe(2);

    const { failedTasks, reQueuedTasks } = await handleStalledTasks({
      queue,
      client,
      tasks: [retrievedTaskToRequeue],
    });
    expect(failedTasks.length).toBe(0);
    expect(reQueuedTasks.length).toBe(1);
    expect(reQueuedTasks[0].id).toBe(taskToRequeue.id);

    const retriedTask = (await getTaskById({
      queue,
      client,
      taskId: taskToRequeue.id,
    })) as Task;
    expect(retriedTask.status).toBe(TaskStatus.Queued);
    expect(retriedTask.retries).toBe(1);
    expect(retriedTask.stallRetries).toBe(1);
    expect(retriedTask.processingStartedAt).toBe(undefined);
    expect(retriedTask.processingEndedAt).toBe(undefined);
    expect(retriedTask.error).toBe(undefined);
    expect(retriedTask.result).toBe(undefined);
  });
  it('handleStalledTasks fails task exceeding retryLimit', async () => {
    const taskToFail: Task = {
      id: 'b',
      data: 'c',
      retries: 1,
      retryLimit: 1,
    };
    await enqueueTask({ queue, task: taskToFail, client });

    const retrievedTaskToFail = (await getTaskById({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(retrievedTaskToFail.retries).toBe(1);
    expect(retrievedTaskToFail.retryLimit).toBe(1);

    const { failedTasks, reQueuedTasks } = await handleStalledTasks({
      queue,
      client,
      tasks: [retrievedTaskToFail],
    });
    expect(reQueuedTasks.length).toBe(0);
    expect(failedTasks.length).toBe(1);
    expect(failedTasks[0].id).toBe(taskToFail.id);

    const failedTask = (await getTaskById({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(failedTask.status).toBe(TaskStatus.Failed);
    expect(failedTask.retries).toBe(1);
    expect(failedTask.retryLimit).toBe(1);
    expect(failedTask.errorRetries).toBe(0);
    expect(failedTask.stallRetries).toBe(0);
    expect(failedTask.error).toBe('Retry limit reached');
  });
  it('handleStalledTasks fails task exceeding stallRetryLimit', async () => {
    const taskToFail: Task = {
      id: 'b',
      data: 'c',
      stallRetries: 1,
      stallRetryLimit: 1,
      retryLimit: 2,
    };
    await enqueueTask({ queue, task: taskToFail, client });

    const retrievedTaskToFail = (await getTaskById({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(retrievedTaskToFail.errorRetries).toBe(0);
    expect(retrievedTaskToFail.errorRetryLimit).toBe(0);
    expect(retrievedTaskToFail.stallRetries).toBe(1);
    expect(retrievedTaskToFail.stallRetryLimit).toBe(1);
    expect(retrievedTaskToFail.retryLimit).toBe(2);

    const { failedTasks, reQueuedTasks } = await handleStalledTasks({
      queue,
      client,
      tasks: [retrievedTaskToFail],
    });
    expect(reQueuedTasks.length).toBe(0);
    expect(failedTasks.length).toBe(1);
    expect(failedTasks[0].id).toBe(taskToFail.id);

    const failedTask = (await getTaskById({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(failedTask.status).toBe(TaskStatus.Failed);
    expect(failedTask.retries).toBe(0);
    expect(failedTask.retryLimit).toBe(2);
    expect(failedTask.errorRetries).toBe(0);
    expect(failedTask.stallRetries).toBe(1);
    expect(failedTask.stallRetryLimit).toBe(1);
    expect(failedTask.error).toBe('Stall retry limit reached');
  });
});

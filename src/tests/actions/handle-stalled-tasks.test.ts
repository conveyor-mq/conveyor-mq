import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { getTask } from '../../actions/get-task';
import { handleStalledTasks } from '../../actions/handle-stalled-tasks';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { TaskStatuses } from '../../domain/tasks/task-statuses';

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
      maxAttemptCount: 2,
    };
    await enqueueTask({ queue, task: taskToRequeue, client });

    const retrievedTaskToRequeue = (await getTask({
      queue,
      client,
      taskId: taskToRequeue.id,
    })) as Task;
    expect(retrievedTaskToRequeue.attemptCount).toBe(1);
    expect(retrievedTaskToRequeue.maxAttemptCount).toBe(2);

    const { failedTasks, reQueuedTasks } = await handleStalledTasks({
      queue,
      client,
      tasks: [retrievedTaskToRequeue],
    });
    expect(failedTasks.length).toBe(0);

    expect(reQueuedTasks.length).toBe(1);
    expect(reQueuedTasks[0].id).toBe(taskToRequeue.id);
    const retriedTask = (await getTask({
      queue,
      client,
      taskId: taskToRequeue.id,
    })) as Task;
    expect(retriedTask.status).toBe(TaskStatuses.Queued);
    expect(retriedTask.attemptCount).toBe(2);
    expect(retriedTask.processingStartedOn).toBe(undefined);
    expect(retriedTask.processingEndedOn).toBe(undefined);
    expect(retriedTask.error).toBe(undefined);
    expect(retriedTask.result).toBe(undefined);
  });
  it('handleStalledTasks fails task exceeding maxAttemptCount', async () => {
    const taskToFail: Task = {
      id: 'b',
      data: 'c',
      maxAttemptCount: 1,
    };
    await enqueueTask({ queue, task: taskToFail, client });

    const retrievedTaskToFail = (await getTask({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(retrievedTaskToFail.attemptCount).toBe(1);
    expect(retrievedTaskToFail.maxAttemptCount).toBe(1);

    const { failedTasks, reQueuedTasks } = await handleStalledTasks({
      queue,
      client,
      tasks: [retrievedTaskToFail],
    });

    expect(reQueuedTasks.length).toBe(0);

    expect(failedTasks.length).toBe(1);
    expect(failedTasks[0].id).toBe(taskToFail.id);
    const failedTask = (await getTask({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(failedTask.status).toBe(TaskStatuses.Failed);
    expect(failedTask.attemptCount).toBe(1);
    expect(failedTask.maxAttemptCount).toBe(1);
    expect(failedTask.errorCount).toBe(0);
    expect(failedTask.error).toBe('Max attempt count exceeded');
  });
  it('handleStalledTasks fails task exceeding maxErrorCount', async () => {
    const taskToFail: Task = {
      id: 'b',
      data: 'c',
      errorCount: 1,
      maxErrorCount: 1,
      maxAttemptCount: 2,
    };
    await enqueueTask({ queue, task: taskToFail, client });

    const retrievedTaskToFail = (await getTask({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(retrievedTaskToFail.errorCount).toBe(1);
    expect(retrievedTaskToFail.maxErrorCount).toBe(1);

    const { failedTasks, reQueuedTasks } = await handleStalledTasks({
      queue,
      client,
      tasks: [retrievedTaskToFail],
    });

    expect(reQueuedTasks.length).toBe(0);

    expect(failedTasks.length).toBe(1);
    expect(failedTasks[0].id).toBe(taskToFail.id);
    const failedTask = (await getTask({
      queue,
      client,
      taskId: taskToFail.id,
    })) as Task;
    expect(failedTask.status).toBe(TaskStatuses.Failed);
    expect(failedTask.attemptCount).toBe(1);
    expect(failedTask.maxAttemptCount).toBe(2);
    expect(failedTask.errorCount).toBe(1);
    expect(failedTask.error).toBe('Max error count exceeded');
  });
});

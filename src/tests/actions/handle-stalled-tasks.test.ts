import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { putTask } from '../../actions/put-task';
import { getTask } from '../../actions/get-task';
import { handleStalledTasks } from '../../actions/handle-stalled-tasks';
import { takeTask } from '../../actions/take-task';
import { redisConfig } from '../config';
import { Task } from '../../domain/task';
import { TaskStatuses } from '../../domain/task-statuses';

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
    const taskToFail: Task = {
      id: 'b',
      data: 'c',
      maxAttemptCount: 1,
    };
    await putTask({ queue, task: taskToRequeue, client });
    await putTask({ queue, task: taskToFail, client });

    const retrievedTaskToRequeue = (await getTask({
      queue,
      client,
      taskId: taskToRequeue.id,
    })) as Task;
    expect(retrievedTaskToRequeue.attemptCount).toBe(1);
    expect(retrievedTaskToRequeue.maxAttemptCount).toBe(2);

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
      tasks: [retrievedTaskToRequeue, retrievedTaskToFail],
    });

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
});

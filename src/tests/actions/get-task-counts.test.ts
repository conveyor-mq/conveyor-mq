import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { redisConfig } from '../config';
import { takeTask } from '../../actions/take-task';
import { Task } from '../../domain/tasks/task';
import { enqueueTasks } from '../../actions/enqueue-tasks';
import { markTaskSuccess } from '../../actions/mark-task-success';
import { markTaskFailed } from '../../actions/mark-task-failed';
import { getTaskCounts } from '../../actions/get-task-counts';
import { scheduleTask } from '../../actions/schedule-task';

describe('getTaskCounts', () => {
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

  it('getTaskCounts gets counts', async () => {
    const task1 = { id: '1', data: 'c', enqueueAfter: new Date() };
    const task2 = { id: '2', data: 'c' };
    const task3 = { id: '3', data: 'c' };
    const task4 = { id: '4', data: 'c' };
    const task5 = { id: '5', data: 'c' };
    const task6 = { id: '6', data: 'c' };
    await scheduleTask({ task: task1, queue, client });
    await enqueueTasks({
      queue,
      tasks: [task2, task3, task4, task5, task6],
      client,
    });
    await takeTask({ queue, client });
    const successfulTask = (await takeTask({ queue, client })) as Task;
    const failedTask = (await takeTask({ queue, client })) as Task;
    await markTaskSuccess({
      taskId: successfulTask.id,
      queue,
      client,
      result: 'some-result',
      asOf: new Date(),
    });
    await markTaskFailed({
      task: failedTask,
      queue,
      client,
      error: 'some-error',
      asOf: new Date(),
    });

    const {
      scheduledCount,
      queuedCount,
      processingCount,
      successCount,
      failedCount,
    } = await getTaskCounts({ queue, client });

    expect(scheduledCount).toBe(1);
    expect(queuedCount).toBe(2);
    expect(processingCount).toBe(1);
    expect(successCount).toBe(1);
    expect(failedCount).toBe(1);
  });
});

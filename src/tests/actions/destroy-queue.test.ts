import { Redis } from 'ioredis';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { takeTask } from '../../actions/take-task';
import { redisConfig } from '../config';
import { enqueueTasks } from '../../actions/enqueue-tasks';
import { markTaskSuccess } from '../../actions/mark-task-success';
import { Task } from '../../domain/tasks/task';
import { markTaskFailed } from '../../actions/mark-task-failed';
import { destroyQueue } from '../../actions/destroy-queue';
import {
  getQueuedListKey,
  getProcessingListKey,
  getSuccessListKey,
  getFailedListKey,
  getScheduledSetKey,
  getStallingHashKey,
} from '../../utils/keys';

describe('destroyQueue', () => {
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

  it('destroyQueue destroys queue', async () => {
    const task1 = { id: '1', data: 'c', enqueueAfter: new Date() };
    const task2 = { id: '2', data: 'c' };
    const task3 = { id: '3', data: 'c' };
    const task4 = { id: '4', data: 'c' };
    const task5 = { id: '5', data: 'c' };
    const task6 = { id: '6', data: 'c' };
    await enqueueTasks({
      queue,
      tasks: [task1, task2, task3, task4, task5, task6],
      client,
    });
    await takeTask({ queue, client });
    const successfulTask = (await takeTask({ queue, client })) as Task;
    const failedTask = (await takeTask({ queue, client })) as Task;
    await markTaskSuccess({
      task: successfulTask,
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
    });
    await destroyQueue({ queue, client });
    const exists = await client.exists(
      getScheduledSetKey({ queue }),
      getQueuedListKey({ queue }),
      getProcessingListKey({ queue }),
      getStallingHashKey({ queue }),
      getSuccessListKey({ queue }),
      getFailedListKey({ queue }),
    );
    expect(exists).toBe(0);
  });
});

import { Redis } from 'ioredis';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTask } from '../../actions/take-task';
import { redisConfig } from '../config';
import { areTasksStalled } from '../../actions/are-tasks-stalled';
import { markTaskFailed } from '../../actions/mark-task-failed';
import { markTaskSuccess } from '../../actions/mark-task-success';

describe('areTasksStalled', () => {
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

  it('areTasksStalled returns stalled tasks', async () => {
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };

    await enqueueTask({ queue, task: taskA, client });
    await enqueueTask({ queue, task: taskB, client });

    const [resultA, resultB] = await areTasksStalled({
      taskIds: [taskA.id, taskB.id],
      queue,
      client,
    });
    expect(resultA.taskId).toBe(taskA.id);
    expect(resultA.isStalled).toBe(false);
    expect(resultB.taskId).toBe(taskB.id);
    expect(resultB.isStalled).toBe(false);

    await takeTask({ queue, client, stallTimeout: 1 });
    await takeTask({ queue, client, stallTimeout: 100 });
    await sleep(50);

    const [resultA2, resultB2] = await areTasksStalled({
      taskIds: [taskA.id, taskB.id],
      queue,
      client,
    });
    expect(resultA2.taskId).toBe(taskA.id);
    expect(resultA2.isStalled).toBe(true);
    expect(resultB2.taskId).toBe(taskB.id);
    expect(resultB2.isStalled).toBe(false);
  });
  it('areTasksStalled returns false for failed tasks', async () => {
    const taskA = { id: 'a', data: 'c' };
    await enqueueTask({ queue, task: taskA, client });
    const [result] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result.taskId).toBe(taskA.id);
    expect(result.isStalled).toBe(false);
    await takeTask({ queue, client, stallTimeout: 1 });
    await sleep(10);

    const [result2] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result2.taskId).toBe(taskA.id);
    expect(result2.isStalled).toBe(true);

    await markTaskFailed({
      task: taskA,
      queue,
      client,
      error: 'some-error',
    });

    const [result3] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result3.taskId).toBe(taskA.id);
    expect(result3.isStalled).toBe(false);
  });
  it('areTasksStalled returns false for success tasks', async () => {
    const taskA = { id: 'a', data: 'c' };
    await enqueueTask({ queue, task: taskA, client });
    const [result] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result.taskId).toBe(taskA.id);
    expect(result.isStalled).toBe(false);
    await takeTask({ queue, client, stallTimeout: 1 });
    await sleep(10);

    const [result2] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result2.taskId).toBe(taskA.id);
    expect(result2.isStalled).toBe(true);

    await markTaskSuccess({
      task: taskA,
      queue,
      client,
      result: 'some-result',
      asOf: new Date(),
    });

    const [result3] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result3.taskId).toBe(taskA.id);
    expect(result3.isStalled).toBe(false);
  });
});

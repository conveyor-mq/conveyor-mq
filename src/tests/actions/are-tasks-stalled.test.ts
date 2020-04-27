import { Redis } from 'ioredis';
import moment from 'moment';
import { flushAll, quit, createClient } from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { putTask } from '../../actions/put-task';
import { takeTask } from '../../actions/take-task';
import { redisConfig } from '../config';
import { areTasksStalled } from '../../actions/are-tasks-stalled';
import { markTaskFailed } from '../../actions/mark-task-failed';
import { markTaskSuccess } from '../../actions/mark-task-success';

describe('areTasksStalled', () => {
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

  it('areTasksStalled returns stalled tasks', async () => {
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };

    await putTask({ queue, task: taskA, client });
    await putTask({ queue, task: taskB, client });

    const [resultA, resultB] = await areTasksStalled({
      taskIds: [taskA.id, taskB.id],
      queue,
      client,
    });
    expect(resultA.taskId).toBe(taskA.id);
    expect(resultA.isStalled).toBe(false);
    expect(resultB.taskId).toBe(taskB.id);
    expect(resultB.isStalled).toBe(false);

    await takeTask({ queue, client, stallDuration: 1 });
    await takeTask({ queue, client, stallDuration: 100 });
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
    await putTask({ queue, task: taskA, client });
    const [result] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result.taskId).toBe(taskA.id);
    expect(result.isStalled).toBe(false);
    await takeTask({ queue, client, stallDuration: 1 });

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
      asOf: moment(),
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
    await putTask({ queue, task: taskA, client });
    const [result] = await areTasksStalled({
      taskIds: [taskA.id],
      queue,
      client,
    });
    expect(result.taskId).toBe(taskA.id);
    expect(result.isStalled).toBe(false);
    await takeTask({ queue, client, stallDuration: 1 });

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
      asOf: moment(),
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
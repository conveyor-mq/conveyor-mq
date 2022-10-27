import { Redis } from 'ioredis';
import { scheduleTask } from '../../actions/schedule-task';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { Task } from '../../domain/tasks/task';
import { TaskStatus } from '../../domain/tasks/task-status';
import { addByHoursToDate, dateToUnix } from '../../utils/date';
import { createUuid } from '../../utils/general';
import { getScheduledSetKey } from '../../utils/keys';
import {
  createClientAndLoadLuaScripts,
  flushAll,
  quit,
  zrangebyscore,
} from '../../utils/redis';
import { redisConfig } from '../config';

describe('scheduleTask', () => {
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

  it('scheduleTask sets task defaults', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      enqueueAfter: addByHoursToDate(1),
    };
    const scheduledTask = await scheduleTask({ queue, client, task });
    expect(scheduledTask.data).toBe(task.data);
    expect(typeof scheduledTask.createdAt).toBe('object'); // Moment date is type 'object'.
    expect(scheduledTask.queuedAt).toBe(undefined);
    expect(scheduledTask.processingStartedAt).toBe(undefined);
    expect(scheduledTask.processingEndedAt).toBe(undefined);
    expect(scheduledTask.retries).toBe(0);
    expect(scheduledTask.retryLimit).toBe(undefined);
    expect(scheduledTask.errorRetries).toBe(0);
    expect(scheduledTask.errorRetryLimit).toBe(0);
    expect(scheduledTask.stallRetries).toBe(0);
    expect(scheduledTask.stallRetryLimit).toBe(1);
  });
  it('scheduleTask handles null retry limits', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      retryLimit: null,
      errorRetryLimit: null,
      stallRetryLimit: null,
      enqueueAfter: addByHoursToDate(1),
    };
    const scheduledTask = await scheduleTask({ queue, client, task });
    expect(scheduledTask.data).toBe(task.data);
    expect(typeof scheduledTask.createdAt).toBe('object'); // Moment date is type 'object'.
    expect(scheduledTask.queuedAt).toBe(undefined);
    expect(scheduledTask.processingStartedAt).toBe(undefined);
    expect(scheduledTask.processingEndedAt).toBe(undefined);
    expect(scheduledTask.retries).toBe(0);
    expect(scheduledTask.retryLimit).toBe(null);
    expect(scheduledTask.errorRetries).toBe(0);
    expect(scheduledTask.errorRetryLimit).toBe(null);
    expect(scheduledTask.stallRetries).toBe(0);
    expect(scheduledTask.stallRetryLimit).toBe(null);
  });
  it('enqueueTask schedules delayed task', async () => {
    const enqueueAfter = addByHoursToDate(1);
    const task: Task = {
      id: 'a',
      data: 'b',
      enqueueAfter,
    };
    const scheduledTask = await scheduleTask({ queue, client, task });
    expect(scheduledTask.status).toBe(TaskStatus.Scheduled);

    const taskResult = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(taskResult).toBe(null);

    const [taskId] = await zrangebyscore({
      client,
      key: getScheduledSetKey({ queue }),
      min: 0,
      max: dateToUnix(enqueueAfter),
    });
    expect(taskId).toBe(task.id);
  });
});

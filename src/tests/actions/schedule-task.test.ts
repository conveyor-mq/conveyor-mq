import moment from 'moment';
import { Redis } from 'ioredis';
import { flushAll, quit, createClient, zrangebyscore } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { getScheduledSetKey } from '../../utils/keys';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { TaskStatus } from '../../domain/tasks/task-status';
import { takeTask } from '../../actions/take-task';
import { scheduleTask } from '../../actions/schedule-task';

describe('scheduleTask', () => {
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

  it('scheduleTask sets task defaults', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      enqueueAfter: moment().add(1, 'hours').toDate(),
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
      enqueueAfter: moment().add(1, 'hours').toDate(),
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
    const enqueueAfter = moment().add(1, 'hours').toDate();
    const task: Task = {
      id: 'a',
      data: 'b',
      enqueueAfter,
    };
    const scheduledTask = await scheduleTask({ queue, client, task });
    expect(scheduledTask.status).toBe(TaskStatus.Scheduled);

    const taskResult = await takeTask({ queue, client });
    expect(taskResult).toBe(null);

    const [taskId] = await zrangebyscore({
      client,
      key: getScheduledSetKey({ queue }),
      min: 0,
      max: moment(enqueueAfter).unix(),
    });
    expect(taskId).toBe(task.id);
  });
});

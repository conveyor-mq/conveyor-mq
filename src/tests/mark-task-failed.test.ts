/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { putTask } from '../actions/put-task';
import { TaskStatuses } from '../domain/task-statuses';
import { takeTask } from '../actions/take-task';
import { markTaskFailed } from '../actions/mark-task-failed';
import { flushAll, quit } from '../utils/redis';
import { createUuid } from '../utils/general';
import { redisConfig } from './config';

describe('markTaskFailed', () => {
  const client = redis.createClient(redisConfig);
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('markTaskFailed marks task failed', async () => {
    const task = { id: 'i', data: 'j' };
    await putTask({ queue, client, task });
    const acquiredTask = (await takeTask({ queue, client })) as Task;
    const failedTask = await markTaskFailed({
      task: acquiredTask,
      queue,
      client,
      error: 'aww :(',
      asOf: moment(),
    });
    expect(failedTask).toHaveProperty('status', TaskStatuses.Failed);
    expect(failedTask).toHaveProperty('error', 'aww :(');
  });
});

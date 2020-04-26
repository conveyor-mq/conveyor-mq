/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { putTask } from '../actions/put-task';
import { TaskStatuses } from '../domain/task-statuses';
import { takeTask } from '../actions/take-task';
import { markTaskSuccess } from '../actions/mark-task-success';
import { flushAll, quit } from '../utils/redis';
import { createUuid } from '../utils/general';
import { redisConfig } from './config';

describe('markTaskSuccessful', () => {
  const client = redis.createClient(redisConfig);
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('markTaskSuccessful marks task successful', async () => {
    const task = { id: 'g', data: 'h' };
    await putTask({ queue, client, task });
    const acquiredTask = (await takeTask({ queue, client })) as Task;
    const successfulTask = await markTaskSuccess({
      task: acquiredTask,
      queue,
      client,
      result: 'horaay!',
      asOf: moment(),
    });
    expect(successfulTask).toHaveProperty('status', TaskStatuses.Success);
    expect(successfulTask).toHaveProperty('result', 'horaay!');
  });
});

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { putTask } from '../actions/put-task';
import { TaskStatuses } from '../domain/task-statuses';
import { flushAll, quit } from '../utils/redis';
import { createUuid } from '../utils/general';

describe('putTask', () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('putTask adds task to a queue', async () => {
    const task: Task = { id: 'a', data: 'b' };
    const queuedTask = await putTask({ queue, client, task });
    expect(queuedTask.data).toBe(task.data);
    expect(typeof queuedTask.queuedOn).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedOn).toBe(undefined);
    expect(queuedTask.processingEndedOn).toBe(undefined);
    expect(queuedTask.status).toBe(TaskStatuses.Queued);
    expect(queuedTask.data).toBe(task.data);
    expect(queuedTask.attemptCount).toBe(1);
  });
  it('putTask resets processing dates', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      queuedOn: moment(),
      processingStartedOn: moment(),
      processingEndedOn: moment(),
    };
    const queuedTask = await putTask({ queue, client, task });
    expect(typeof queuedTask.queuedOn).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedOn).toBe(undefined);
    expect(queuedTask.processingEndedOn).toBe(undefined);
  });
});

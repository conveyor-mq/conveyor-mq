/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { putTask } from '../actions/put-task';
import { TaskStatuses } from '../domain/task-statuses';
import { flushAll, quit, lrange } from '../utils/redis';
import { createUuid } from '../utils/general';
import { getTask } from '../actions/get-task';
import { getQueuedListKey } from '../utils/keys';
import { redisConfig } from './config';

describe('putTask', () => {
  const client = redis.createClient(redisConfig);
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

    const fetchedTask = (await getTask({
      queue,
      taskId: task.id,
      client,
    })) as Task;
    expect(fetchedTask.id).toBe(task.id);

    const queuedTaskIds = await lrange({
      key: getQueuedListKey({ queue }),
      start: 0,
      stop: -1,
      client,
    });
    expect(queuedTaskIds.length).toBe(1);
    expect(queuedTaskIds[0]).toBe(task.id);
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

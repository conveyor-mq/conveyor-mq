import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import {
  flushAll,
  quit,
  lrange,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { getTaskById } from '../../actions/get-task-by-id';
import { getQueuedListKey } from '../../utils/keys';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { TaskStatus } from '../../domain/tasks/task-status';
import { pauseQueue } from '../../actions/pause-queue';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { resumeQueue } from '../../actions/resume-queue';

describe('enqueueTask', () => {
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

  it('enqueueTask sets task defaults', async () => {
    const task: Task = { id: 'a', data: 'b' };
    const queuedTask = await enqueueTask({ queue, client, task });
    expect(queuedTask.data).toBe(task.data);
    expect(typeof queuedTask.createdAt).toBe('object'); // Moment date is type 'object'.
    expect(typeof queuedTask.queuedAt).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedAt).toBe(undefined);
    expect(queuedTask.processingEndedAt).toBe(undefined);
    expect(queuedTask.retries).toBe(0);
    expect(queuedTask.retryLimit).toBe(undefined);
    expect(queuedTask.errorRetries).toBe(0);
    expect(queuedTask.errorRetryLimit).toBe(0);
    expect(queuedTask.stallRetries).toBe(0);
    expect(queuedTask.stallRetryLimit).toBe(1);
  });
  it('enqueueTask handles null retry limits', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      retryLimit: null,
      errorRetryLimit: null,
      stallRetryLimit: null,
    };
    const queuedTask = await enqueueTask({ queue, client, task });
    expect(queuedTask.data).toBe(task.data);
    expect(typeof queuedTask.queuedAt).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedAt).toBe(undefined);
    expect(queuedTask.processingEndedAt).toBe(undefined);
    expect(queuedTask.retries).toBe(0);
    expect(queuedTask.retryLimit).toBe(null);
    expect(queuedTask.errorRetries).toBe(0);
    expect(queuedTask.errorRetryLimit).toBe(null);
    expect(queuedTask.stallRetries).toBe(0);
    expect(queuedTask.stallRetryLimit).toBe(null);
  });
  it('enqueueTask adds task to a queue', async () => {
    const task: Task = { id: 'a', data: 'b' };
    const queuedTask = await enqueueTask({ queue, client, task });
    expect(queuedTask.data).toBe(task.data);
    expect(typeof queuedTask.queuedAt).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedAt).toBe(undefined);
    expect(queuedTask.processingEndedAt).toBe(undefined);
    expect(queuedTask.status).toBe(TaskStatus.Queued);
    expect(queuedTask.data).toBe(task.data);

    const fetchedTask = (await getTaskById({
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
  it('enqueueTask resets processing dates', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      queuedAt: new Date(),
      processingStartedAt: new Date(),
      processingEndedAt: new Date(),
    };
    const queuedTask = await enqueueTask({ queue, client, task });
    expect(typeof queuedTask.queuedAt).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedAt).toBe(undefined);
    expect(queuedTask.processingEndedAt).toBe(undefined);
  });
  it('enqueueTask adds task to paused list if queue is paused', async () => {
    const task: Task = {
      id: 'a',
      data: 'b',
      queuedAt: new Date(),
      processingStartedAt: new Date(),
      processingEndedAt: new Date(),
    };
    await pauseQueue({ queue, client });
    const queuedTask = await enqueueTask({ queue, client, task });
    expect(typeof queuedTask.queuedAt).toBe('object'); // Moment date is type 'object'.
    expect(queuedTask.processingStartedAt).toBe(undefined);
    expect(queuedTask.processingEndedAt).toBe(undefined);
    const result = await takeTaskAndMarkAsProcessing({
      queue,
      client,
      stallTimeout: 1000,
    });
    expect(result).toBe(null);

    await resumeQueue({ queue, client });

    const result2 = await takeTaskAndMarkAsProcessing({
      queue,
      client,
      stallTimeout: 1000,
    });
    expect(result2?.id).toBe(task.id);
  });
});

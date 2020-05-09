import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { createWorker } from '../../actions/create-worker';
import { redisConfig } from '../config';
import { getTask } from '../../actions/get-task';
import { TaskStatuses } from '../../domain/tasks/task-statuses';
import { Task } from '../../domain/tasks/task';

describe('createWorker', () => {
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

  it('createWorker quits worker', async () => {
    const theTask = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task: theTask, client });
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatuses.Processing);
        return 'some data';
      },
    });
    await worker.quit();
  });
  it('createWorker processes task', async () => {
    const theTask = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task: theTask, client });
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatuses.Processing);
        return 'some data';
      },
    });
    await sleep(50);
    const processedTask = (await getTask({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(processedTask.id).toBe(theTask.id);
    expect(processedTask.status).toBe(TaskStatuses.Success);
    // await worker.quit();
  });
  it('createWorker onReady fires', async () => {
    const theTask = { id: 'b', data: 'c' };
    const promise = new Promise((resolve) => {
      createWorker({
        queue,
        onReady: () => resolve('worker is ready'),
        redisConfig,
        handler: ({ task }) => {
          expect(task.id).toBe(theTask.id);
          expect(task.status).toBe(TaskStatuses.Processing);
          return 'some data';
        },
      });
    });
    expect(promise).resolves.toBe('worker is ready');
  });
  it('createWorker onIdle fires', async () => {
    const theTask = { id: 'b', data: 'c' };
    const promise = new Promise((resolve) => {
      return createWorker({
        queue,
        onIdle: () => resolve('worker is idle'),
        redisConfig,
        handler: ({ task }) => {
          expect(task.id).toBe(theTask.id);
          expect(task.status).toBe(TaskStatuses.Processing);
          return 'some data';
        },
      });
    });
    await enqueueTask({
      queue,
      task: theTask,
      client,
    });
    expect(promise).resolves.toBe('worker is idle');
  });
  it.skip('createWorker handles autoStart false', async () => {
    const theTask = { id: 'b', data: 'c' };
    const worker = await createWorker({
      queue,
      redisConfig,
      autoStart: false,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatuses.Processing);
        return 'some data';
      },
    });
    await enqueueTask({
      queue,
      task: theTask,
      client,
    });
    await expect(
      getTask({ queue, taskId: theTask.id, client }),
    ).resolves.toHaveProperty('status', TaskStatuses.Queued);
    await worker.resume();
    await sleep(50);
    await expect(
      getTask({ queue, taskId: theTask.id, client }),
    ).resolves.toHaveProperty('status', TaskStatuses.Success);
    await worker.quit();
  });
});

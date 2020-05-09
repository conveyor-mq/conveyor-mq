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

  it('createWorker shutdown shuts down worker', async () => {
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
    await worker.shutdown();
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
    await worker.shutdown();
  });
  it('createWorker onReady fires', async () => {
    const theTask = { id: 'b', data: 'c' };
    const promise = new Promise((resolve) => {
      const workerPromise = createWorker({
        queue,
        onReady: () => resolve({ message: 'worker is ready', workerPromise }),
        redisConfig,
        handler: ({ task }) => {
          expect(task.id).toBe(theTask.id);
          expect(task.status).toBe(TaskStatuses.Processing);
          return 'some data';
        },
      });
    });
    const { message, workerPromise } = (await promise) as {
      message: string;
      workerPromise: Promise<any>;
    };
    expect(message).toBe('worker is ready');
    const worker = await workerPromise;
    await worker.shutdown();
  });
  it('createWorker onIdle fires', async () => {
    const theTask = { id: 'b', data: 'c' };
    const promise = new Promise((resolve) => {
      const workerPromise = createWorker({
        queue,
        onIdle: () => resolve({ message: 'worker is idle', workerPromise }),
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
    const { message, workerPromise } = (await promise) as {
      message: string;
      workerPromise: Promise<any>;
    };
    expect(message).toBe('worker is idle');
    const worker = await workerPromise;
    await worker.shutdown();
  });
  it('createWorker pause pauses worker', async () => {
    const taskA = { id: 'a', data: 'c' };
    const taskB = { id: 'b', data: 'c' };
    const worker = await createWorker({
      queue,
      redisConfig,
      handler: () => {
        return 'some data';
      },
    });
    await enqueueTask({
      queue,
      task: taskA,
      client,
    });
    await sleep(50);

    const fetchedTaskA = (await getTask({
      queue,
      taskId: taskA.id,
      client,
    })) as Task;
    expect(fetchedTaskA.id).toBe(taskA.id);
    expect(fetchedTaskA.status).toBe(TaskStatuses.Success);

    await worker.pause();

    await enqueueTask({
      queue,
      task: taskB,
      client,
    });
    await sleep(50);
    const fetchedTaskB = (await getTask({
      queue,
      taskId: taskB.id,
      client,
    })) as Task;
    expect(fetchedTaskB.id).toBe(taskB.id);
    expect(fetchedTaskB.status).toBe(TaskStatuses.Queued);

    await worker.start();
    await sleep(500);

    const fetchedTaskB2 = (await getTask({
      queue,
      taskId: taskB.id,
      client,
    })) as Task;
    expect(fetchedTaskB2.id).toBe(taskB.id);
    expect(fetchedTaskB2.status).toBe(TaskStatuses.Success);
    await worker.shutdown();
  });
  it('createWorker handles autoStart false', async () => {
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
    await worker.start();
    await sleep(50);
    await expect(
      getTask({ queue, taskId: theTask.id, client }),
    ).resolves.toHaveProperty('status', TaskStatuses.Success);
    await worker.shutdown();
  });
});

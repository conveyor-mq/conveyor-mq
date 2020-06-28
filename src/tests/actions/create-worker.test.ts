import RedisClient, { Redis } from 'ioredis';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { createWorker } from '../../actions/create-worker';
import { redisConfig } from '../config';
import { getTaskById } from '../../actions/get-task-by-id';
import { TaskStatus } from '../../domain/tasks/task-status';
import { Task } from '../../domain/tasks/task';
import { createListener } from '../../actions/create-listener';
import { EventType } from '../../domain/events/event-type';
import { Event } from '../../domain/events/event';
import { loadLuaScripts } from '../../lua';
import { createManager } from '../../actions/create-manager';

describe('createWorker', () => {
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

  it('createWorker shutdown shuts down worker', async () => {
    const theTask = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task: theTask, client });
    const worker = createWorker({
      queue,
      redisConfig,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatus.Processing);
        return 'some data';
      },
    });
    await worker.onReady();
    await worker.shutdown();
  });
  it('createWorker processes task', async () => {
    const theTask = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task: theTask, client });
    const worker = createWorker({
      queue,
      redisConfig,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatus.Processing);
        return 'some data';
      },
    });
    await worker.onReady();
    await sleep(50);
    const processedTask = (await getTaskById({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(processedTask.id).toBe(theTask.id);
    expect(processedTask.status).toBe(TaskStatus.Success);
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
          expect(task.status).toBe(TaskStatus.Processing);
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
          expect(task.status).toBe(TaskStatus.Processing);
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
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => {
        return 'some data';
      },
    });
    await worker.onReady();

    await enqueueTask({
      queue,
      task: taskA,
      client,
    });
    await sleep(50);

    const fetchedTaskA = (await getTaskById({
      queue,
      taskId: taskA.id,
      client,
    })) as Task;
    expect(fetchedTaskA.id).toBe(taskA.id);
    expect(fetchedTaskA.status).toBe(TaskStatus.Success);

    await worker.pause();

    await enqueueTask({
      queue,
      task: taskB,
      client,
    });
    await sleep(50);
    const fetchedTaskB = (await getTaskById({
      queue,
      taskId: taskB.id,
      client,
    })) as Task;
    expect(fetchedTaskB.id).toBe(taskB.id);
    expect(fetchedTaskB.status).toBe(TaskStatus.Queued);

    await worker.start();
    await sleep(50);

    const fetchedTaskB2 = (await getTaskById({
      queue,
      taskId: taskB.id,
      client,
    })) as Task;
    expect(fetchedTaskB2.id).toBe(taskB.id);
    expect(fetchedTaskB2.status).toBe(TaskStatus.Success);
    await worker.shutdown();
  });
  it('createWorker handles autoStart false', async () => {
    const theTask = { id: 'b', data: 'c' };
    const worker = createWorker({
      queue,
      redisConfig,
      autoStart: false,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatus.Processing);
        return 'some data';
      },
    });
    await worker.onReady();
    await enqueueTask({
      queue,
      task: theTask,
      client,
    });
    await sleep(50);
    await expect(
      getTaskById({ queue, taskId: theTask.id, client }),
    ).resolves.toHaveProperty('status', TaskStatus.Queued);
    await worker.start();
    await sleep(50);
    await expect(
      getTaskById({ queue, taskId: theTask.id, client }),
    ).resolves.toHaveProperty('status', TaskStatus.Success);
    await worker.shutdown();
  });
  it('createWorker triggers worker started event', async () => {
    const listener = createListener({ queue, redisConfig });
    const startedPromise = new Promise((resolve) => {
      listener.on(EventType.WorkerStarted, ({ event }) => resolve(event));
    }) as Promise<Event>;
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => {
        return 'some data';
      },
    });
    await worker.onReady();
    const startedEvent = await startedPromise;
    await expect(typeof startedEvent?.worker?.id).toBe('string');
    await expect(typeof startedEvent?.worker?.createdAt).toBe('object');
    await expect(startedEvent?.type).toBe(EventType.WorkerStarted);
    await worker.shutdown();
  });
  it('createWorker triggers worker paused event', async () => {
    const listener = createListener({ queue, redisConfig });
    const pausedPromise = new Promise((resolve) => {
      listener.on(EventType.WorkerPaused, ({ event }) => resolve(event));
    }) as Promise<Event>;
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => {
        return 'some data';
      },
    });
    await worker.pause();
    const pausedEvent = await pausedPromise;
    expect(typeof pausedEvent?.worker?.id).toBe('string');
    expect(typeof pausedEvent?.worker?.createdAt).toBe('object');
    expect(pausedEvent?.type).toBe(EventType.WorkerPaused);
    await worker.shutdown();
  });
  it('createWorker triggers worker shutdown event', async () => {
    const listener = createListener({ queue, redisConfig });
    const shutdownPromise = new Promise((resolve) => {
      listener.on(EventType.WorkerShutdown, ({ event }) => resolve(event));
    }) as Promise<Event>;
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => {
        return 'some data';
      },
    });
    await worker.shutdown();
    const shutdownEvent = await shutdownPromise;
    expect(typeof shutdownEvent?.worker?.id).toBe('string');
    expect(typeof shutdownEvent?.worker?.createdAt).toBe('object');
    expect(shutdownEvent?.type).toBe(EventType.WorkerShutdown);
  });
  it('createWorker can be passed a shared redis client', async () => {
    const redisClient = new RedisClient(redisConfig.port, redisConfig.host);
    const configuredRedisClient = loadLuaScripts({ client: redisClient });
    const manager = createManager({
      queue,
      redisConfig,
      redisClient: configuredRedisClient,
    });
    const worker = createWorker({
      queue,
      redisConfig,
      redisClient: configuredRedisClient,
      handler: () => 'ok',
    });
    const { task } = await manager.enqueueTask({ data: 'hi' });
    await sleep(30);
    expect((await manager.getTaskById(task.id))?.status).toBe(
      TaskStatus.Success,
    );
    await manager.quit();
    await worker.shutdown();
    // A shared redis client should be left ready after worker.shutdown call
    expect(configuredRedisClient.status).toBe('ready');
  });
  it('createWorker calls onBeforeTaskProcessing hook', async () => {
    const fn = jest.fn();
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
      hooks: { onBeforeTaskProcessing: fn },
    });
    const manager = createManager({
      queue,
      redisConfig,
    });
    const { task } = await manager.enqueueTask({ id: 'a', data: 'hi' });
    await sleep(20);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: task.id }),
    );
    await manager.quit();
    await worker.shutdown();
  });
  it('createWorker calls onAfterTaskProcessing hook', async () => {
    const fn = jest.fn();
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
      hooks: { onAfterTaskProcessing: fn },
    });
    const manager = createManager({
      queue,
      redisConfig,
    });
    await manager.enqueueTask({ id: 'a', data: 'hi' });
    await sleep(20);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ task: expect.anything() }),
    );
    await manager.quit();
    await worker.shutdown();
  });
  it('createWorker calls onAfterTaskSuccess hook', async () => {
    const onAfterTaskSuccessFn = jest.fn();
    const onAfterTaskErrorFn = jest.fn();
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => 'some-result',
      hooks: {
        onAfterTaskSuccess: onAfterTaskSuccessFn,
        onAfterTaskError: onAfterTaskErrorFn,
      },
    });
    const manager = createManager({
      queue,
      redisConfig,
    });
    await manager.enqueueTask({ id: 'a', data: 'hi' });
    await sleep(20);
    expect(onAfterTaskErrorFn).toHaveBeenCalledTimes(0);
    expect(onAfterTaskSuccessFn).toHaveBeenCalledTimes(1);
    expect(onAfterTaskSuccessFn).toHaveBeenCalledWith(
      expect.objectContaining({ task: expect.anything() }),
    );
    await manager.quit();
    await worker.shutdown();
  });
  it('createWorker calls onAfterTask{Error,Fail} hook', async () => {
    const onAfterTaskSuccessFn = jest.fn();
    const onAfterTaskErrorFn = jest.fn();
    const onAfterTaskFailFn = jest.fn();
    const worker = createWorker({
      queue,
      redisConfig,
      handler: () => {
        throw new Error('some-error');
      },
      hooks: {
        onAfterTaskSuccess: onAfterTaskSuccessFn,
        onAfterTaskError: onAfterTaskErrorFn,
        onAfterTaskFail: onAfterTaskFailFn,
      },
    });
    await worker.onReady();
    const manager = createManager({
      queue,
      redisConfig,
    });
    await manager.enqueueTask({ id: 'a', data: 'hi' });
    await sleep(20);
    expect(onAfterTaskSuccessFn).toHaveBeenCalledTimes(0);
    expect(onAfterTaskErrorFn).toHaveBeenCalledTimes(1);
    expect(onAfterTaskErrorFn).toHaveBeenCalledWith(
      expect.objectContaining({ task: expect.anything() }),
    );
    expect(onAfterTaskFailFn).toHaveBeenCalledTimes(1);
    expect(onAfterTaskFailFn).toHaveBeenCalledWith(
      expect.objectContaining({ task: expect.anything() }),
    );
    await manager.quit();
    await worker.shutdown();
  });
});

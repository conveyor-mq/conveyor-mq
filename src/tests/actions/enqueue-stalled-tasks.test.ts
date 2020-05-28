import { Redis } from 'ioredis';
import { isTaskStalled } from '../../actions/is-task-stalled';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTask } from '../../actions/take-task';
import { getStalledTasks } from '../../actions/get-stalled-tasks';
import { enqueueStalledTasks } from '../../actions/enqueue-stalled-tasks';
import { getProcessingTasks } from '../../actions/get-processing-tasks';
import { redisConfig } from '../config';
import { getTaskById } from '../../actions/get-task-by-id';

describe('enqueueStalledTasks', () => {
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

  it('enqueueStalledTasks re queues stalled tasks', async () => {
    const taskA = { id: 'a', data: 'f' };
    const taskB = { id: 'b', data: 'g' };
    await enqueueTask({ queue, task: taskA, client });
    await enqueueTask({ queue, task: taskB, client });
    await takeTask({ queue, client, stallTimeout: 150 });
    await takeTask({ queue, client, stallTimeout: 10000 });
    expect((await getProcessingTasks({ queue, client })).length).toBe(2);
    expect((await getStalledTasks({ queue, client })).length).toBe(0);
    expect(await isTaskStalled({ taskId: taskA.id, queue, client })).toBe(
      false,
    );
    expect(await isTaskStalled({ taskId: taskB.id, queue, client })).toBe(
      false,
    );
    await sleep(200);
    const stalledTasks = await getStalledTasks({ queue, client });
    expect(stalledTasks.length).toBe(1);
    expect(stalledTasks[0].id).toBe(taskA.id);
    expect(await isTaskStalled({ taskId: taskA.id, queue, client })).toBe(true);
    expect(await isTaskStalled({ taskId: taskB.id, queue, client })).toBe(
      false,
    );
    await enqueueStalledTasks({ queue, tasks: stalledTasks, client });
    expect((await getStalledTasks({ queue, client })).length).toBe(0);
    const processingTasks = await getProcessingTasks({ queue, client });
    expect(processingTasks.length).toBe(1);
    expect(processingTasks[0].id).toBe(taskB.id);
  });
  it('enqueueStalledTasks increments retries', async () => {
    const taskA = { id: 'a', data: 'f' };

    const enqueuedTask = await enqueueTask({ queue, task: taskA, client });
    expect(enqueuedTask?.retries).toBe(0);
    expect(enqueuedTask?.stallRetries).toBe(0);

    await enqueueStalledTasks({ queue, tasks: [enqueuedTask], client });
    const retrievedTask = await getTaskById({
      queue,
      taskId: taskA.id,
      client,
    });

    expect(retrievedTask?.retries).toBe(1);
    expect(retrievedTask?.stallRetries).toBe(1);
  });
});

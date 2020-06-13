import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { isTaskStalled } from '../../actions/is-task-stalled';
import {
  flushAll,
  quit,
  lrange,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { getQueuedListKey, getProcessingListKey } from '../../utils/keys';
import { redisConfig } from '../config';
import { TaskStatus } from '../../domain/tasks/task-status';

describe('takeTaskAndMarkAsProcessing', () => {
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

  it('takeTaskAndMarkAsProcessing takes task off a queue and returns task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, client, task });
    const processingTask = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(processingTask).toHaveProperty('id', task.id);
    expect(processingTask).toHaveProperty('status', TaskStatus.Processing);

    const queuedTaskIds = await lrange({
      key: getQueuedListKey({ queue }),
      start: 0,
      stop: -1,
      client,
    });
    expect(queuedTaskIds.length).toBe(0);

    const processingTaskIds = await lrange({
      key: getProcessingListKey({ queue }),
      start: 0,
      stop: -1,
      client,
    });
    expect(processingTaskIds.length).toBe(1);

    expect(await takeTaskAndMarkAsProcessing({ queue, client })).toBe(null);
  });
  it('takeTaskAndMarkAsProcessing acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, client, task });
    await takeTaskAndMarkAsProcessing({ queue, client });
    const isStalled = await isTaskStalled({ taskId: task.id, queue, client });
    expect(isStalled).toBe(false);
  });
  it('takeTaskAndMarkAsProcessing returns null when there is no task to take', async () => {
    const task = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(task).toBe(null);
  });
});

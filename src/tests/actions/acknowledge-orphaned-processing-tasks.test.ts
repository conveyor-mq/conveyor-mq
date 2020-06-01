import { Redis } from 'ioredis';
import find from 'lodash/find';
import { isTaskStalled } from '../../actions/is-task-stalled';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
  rpoplpush,
} from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { redisConfig } from '../config';
import { getQueuedListKey, getProcessingListKey } from '../../utils/keys';
import { acknowledgeOrphanedProcessingTasks } from '../../actions/acknowledge-orphaned-processing-tasks';

describe('acknowledgeOrphanedProcessingTasks', () => {
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

  it('acknowledgeOrphanedProcessingTasks does nothing when lists are empty', async () => {
    const acknowledgedTaskIds = await acknowledgeOrphanedProcessingTasks({
      queue,
      client,
    });
    expect(acknowledgedTaskIds.length).toBe(0);
  });
  it('acknowledgeOrphanedProcessingTasks acknowledges orphaned tasks', async () => {
    const task = { id: 'b', data: 'c' };
    const task2 = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task, client });
    await enqueueTask({ queue, task: task2, client });
    await rpoplpush({
      fromKey: getQueuedListKey({ queue }),
      toKey: getProcessingListKey({ queue }),
      client,
    });
    await rpoplpush({
      fromKey: getQueuedListKey({ queue }),
      toKey: getProcessingListKey({ queue }),
      client,
    });
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(false);
    expect(await isTaskStalled({ taskId: task2.id, queue, client })).toBe(
      false,
    );

    const acknowledgedTaskIds = await acknowledgeOrphanedProcessingTasks({
      queue,
      defaultStallTimeout: 1,
      client,
    });
    expect(acknowledgedTaskIds.length).toBe(2);
    expect(find(acknowledgedTaskIds, (taskId) => taskId === task.id)).toBe(
      task.id,
    );
    expect(find(acknowledgedTaskIds, (taskId) => taskId === task2.id)).toBe(
      task2.id,
    );

    await sleep(10);
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(true);
    expect(await isTaskStalled({ taskId: task2.id, queue, client })).toBe(true);
  });
});

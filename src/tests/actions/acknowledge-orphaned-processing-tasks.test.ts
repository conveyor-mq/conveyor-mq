import { Redis } from 'ioredis';
import { isTaskStalled } from '../../actions/is-task-stalled';
import { flushAll, quit, createClient, rpoplpush } from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { redisConfig } from '../config';
import { getQueuedListKey, getProcessingListKey } from '../../utils/keys';
import { acknowledgeOrphanedProcessingTasks } from '../../actions/acknowledge-orphaned-processing-tasks';

describe('acknowledgeOrphanedProcessingTasks', () => {
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

  it('acknowledgeOrphanedProcessingTasks acknowledges task', async () => {
    const task = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task, client });
    await rpoplpush({
      fromKey: getQueuedListKey({ queue }),
      toKey: getProcessingListKey({ queue }),
      client,
    });
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(false);

    const acknowledgedTaskIds = await acknowledgeOrphanedProcessingTasks({
      queue,
      defaultStallTimeout: 1,
      client,
    });
    await sleep(10);

    expect(acknowledgedTaskIds.length).toBe(1);
    expect(acknowledgedTaskIds[0]).toBe(task.id);
    expect(await isTaskStalled({ taskId: task.id, queue, client })).toBe(true);
  });
});

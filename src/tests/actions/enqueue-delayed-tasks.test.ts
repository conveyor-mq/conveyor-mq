import { Redis } from 'ioredis';
import moment from 'moment';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTask } from '../../actions/take-task';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { enqueueDelayedTasks } from '../../actions/enqueue-delayed-tasks';
import { TaskStatuses } from '../../domain/tasks/task-statuses';

describe('enqueueDelayedTasks', () => {
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

  it('enqueueDelayedTasks enqueues tasks', async () => {
    const now = moment();
    const task: Task = { id: 'b', data: 'c', enqueueAfter: now };
    await enqueueTask({ queue, task, client });

    const result = await takeTask({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueDelayedTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatuses.Queued);

    const takenTask = await takeTask({ queue, client });
    expect(takenTask?.id).toBe(task.id);
  });
  it('enqueueDelayedTasks enqueues past tasks', async () => {
    const thePast = moment().subtract(1, 'hour');
    const task: Task = { id: 'b', data: 'c', enqueueAfter: thePast };
    await enqueueTask({ queue, task, client });

    const result = await takeTask({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueDelayedTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatuses.Queued);

    const takenTask = await takeTask({ queue, client });
    expect(takenTask?.id).toBe(task.id);
  });
  it('enqueueDelayedTasks does not enqueue future task', async () => {
    const theFuture = moment().add(1, 'hour');
    const task: Task = { id: 'b', data: 'c', enqueueAfter: theFuture };
    await enqueueTask({ queue, task, client });

    const result = await takeTask({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueDelayedTasks({ queue, client });
    expect(delayedTask).toBe(undefined);

    const result2 = await takeTask({ queue, client });
    expect(result2).toBe(null);
  });
});

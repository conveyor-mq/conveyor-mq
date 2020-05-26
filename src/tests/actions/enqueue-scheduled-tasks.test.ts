import { Redis } from 'ioredis';
import moment from 'moment';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { takeTask } from '../../actions/take-task';
import { redisConfig } from '../config';
import { Task } from '../../domain/tasks/task';
import { enqueueScheduledTasks } from '../../actions/enqueue-scheduled-tasks';
import { TaskStatus } from '../../domain/tasks/task-status';
import { scheduleTask } from '../../actions/schedule-task';
import { createListener } from '../../actions/create-listener';
import { EventType } from '../../domain/events/event-type';

describe('enqueueScheduledTasks', () => {
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

  it('enqueueScheduledTasks enqueues tasks', async () => {
    const now = new Date();
    const task: Task = { id: 'b', data: 'c', enqueueAfter: now };
    await scheduleTask({ queue, task, client });

    const result = await takeTask({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatus.Queued);

    const takenTask = await takeTask({ queue, client });
    expect(takenTask?.id).toBe(task.id);
  });
  it('enqueueScheduledTasks enqueues past tasks', async () => {
    const thePast = moment().subtract(1, 'hour').toDate();
    const task: Task = { id: 'b', data: 'c', enqueueAfter: thePast };
    await scheduleTask({ queue, task, client });

    const result = await takeTask({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatus.Queued);

    const takenTask = await takeTask({ queue, client });
    expect(takenTask?.id).toBe(task.id);
  });
  it('enqueueScheduledTasks triggers taskQueued event', async () => {
    const listener = await createListener({ queue, redisConfig });
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskQueued, () =>
        resolve('task-queue-event-called'),
      );
    });
    const thePast = moment().subtract(1, 'hour').toDate();
    const task: Task = { id: 'b', data: 'c', enqueueAfter: thePast };
    await scheduleTask({ queue, task, client });

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatus.Queued);

    const result = await promise;
    expect(result).toBe('task-queue-event-called');
  });
  it('enqueueScheduledTasks does not enqueue future task', async () => {
    const theFuture = moment().add(1, 'hour').toDate();
    const task: Task = { id: 'b', data: 'c', enqueueAfter: theFuture };
    await scheduleTask({ queue, task, client });

    const result = await takeTask({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask).toBe(undefined);

    const result2 = await takeTask({ queue, client });
    expect(result2).toBe(null);
  });
});

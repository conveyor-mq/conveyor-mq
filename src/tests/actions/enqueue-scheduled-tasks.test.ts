import { Redis } from 'ioredis';
import { createListener } from '../../actions/create-listener';
import { enqueueScheduledTasks } from '../../actions/enqueue-scheduled-tasks';
import { scheduleTask } from '../../actions/schedule-task';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { EventType } from '../../domain/events/event-type';
import { Task } from '../../domain/tasks/task';
import { TaskStatus } from '../../domain/tasks/task-status';
import { addByHourToDate, subtractByHourToDate } from '../../utils/date';
import { createUuid } from '../../utils/general';
import {
  createClientAndLoadLuaScripts,
  flushAll,
  quit,
} from '../../utils/redis';
import { redisConfig } from '../config';

describe('enqueueScheduledTasks', () => {
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

  it('enqueueScheduledTasks enqueues tasks', async () => {
    const now = new Date();
    const task: Task = { id: 'b', data: 'c', enqueueAfter: now };
    await scheduleTask({ queue, task, client });

    const result = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatus.Queued);

    const takenTask = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(takenTask?.id).toBe(task.id);
  });
  it('enqueueScheduledTasks enqueues past tasks', async () => {
    const thePast = subtractByHourToDate(1);
    const task: Task = { id: 'b', data: 'c', enqueueAfter: thePast };
    await scheduleTask({ queue, task, client });

    const result = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatus.Queued);

    const takenTask = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(takenTask?.id).toBe(task.id);
  });
  it('enqueueScheduledTasks triggers taskQueued event', async () => {
    const listener = createListener({ queue, redisConfig });
    await listener.onReady();
    const promise = new Promise((resolve) => {
      listener.on(EventType.TaskQueued, () =>
        resolve('task-queue-event-called'),
      );
    });
    const thePast = subtractByHourToDate(1);
    const task: Task = { id: 'b', data: 'c', enqueueAfter: thePast };
    await scheduleTask({ queue, task, client });

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask?.id).toBe(task.id);
    expect(delayedTask?.status).toBe(TaskStatus.Queued);

    const result = await promise;
    expect(result).toBe('task-queue-event-called');
  });
  it('enqueueScheduledTasks does not enqueue future task', async () => {
    const theFuture = addByHourToDate(1);
    const task: Task = { id: 'b', data: 'c', enqueueAfter: theFuture };
    await scheduleTask({ queue, task, client });

    const result = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(result).toBe(null);

    const [delayedTask] = await enqueueScheduledTasks({ queue, client });
    expect(delayedTask).toBe(undefined);

    const result2 = await takeTaskAndMarkAsProcessing({ queue, client });
    expect(result2).toBe(null);
  });
});

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import { Task } from '../domain/task';
import { putTask } from '../actions/put-task';
import { TaskStatuses } from '../domain/task-statuses';
import { getTask } from '../actions/get-task';
import { registerHandler } from '../actions/register-handler';
import { flushAll } from '../utils/redis';
import { sleep, createUuid } from '../utils/general';

describe.skip('', () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  it('registerHandler handles successful task', async () => {
    const handlerClient = client.duplicate();
    registerHandler({
      queue,
      client: handlerClient,
      handler: async ({ task }: { task: Task }) => {
        await expect(task.status).toBe(TaskStatuses.Processing);
        await expect(task.attemptCount).toBe(1);
        return 'some-task-result';
      },
    });

    const task: Task = {
      id: createUuid(),
      data: 'some-task-data',
      maxAttemptCount: 1,
    };
    await putTask({ queue, client, task });

    await sleep(50);
    const completedTask = await getTask({ queue, taskId: task.id, client });
    await expect(completedTask!.status).toBe(TaskStatuses.Success);
    await expect(completedTask!.result).toBe('some-task-result');
    await expect(completedTask!.error).toBe(undefined);
  });
  it('Handles failed task', async () => {
    const handlerClient = client.duplicate();
    registerHandler({
      queue,
      client: handlerClient,
      handler: async ({ task }: { task: Task }) => {
        await expect(task.status).toBe(TaskStatuses.Processing);
        await expect(task.attemptCount).toBe(1);
        throw new Error('some-error');
      },
    });

    const task: Task = {
      id: createUuid(),
      data: 'some-task-data',
      maxAttemptCount: 0,
    };
    await putTask({ queue, client, task });

    await sleep(50);
    const completedTask = await getTask({ queue, taskId: task.id, client });
    await expect(completedTask!.status).toBe(TaskStatuses.Failed);
    await expect(completedTask!.result).toBe(undefined);
    await expect(completedTask!.error).toBe('some-error');
  });
});

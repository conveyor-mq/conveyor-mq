/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import { isTaskStalled } from '../actions/is-task-stalled';
import { flushAll, quit } from '../utils/redis';
import { sleep, createUuid } from '../utils/general';
import { putTask } from '../actions/put-task';
import { takeTask } from '../actions/take-task';
import { getStalledTasks } from '../actions/get-stalled-tasks';
import { putStalledTasks } from '../actions/put-stalled-tasks';
import { getProcessingTasks } from '../actions/get-processing-tasks';

describe('putStalledTask', () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('putStalledTask re queues stalled tasks', async () => {
    const taskA = { id: 'a', data: 'f' };
    const taskB = { id: 'b', data: 'g' };
    await putTask({ queue, task: taskA, client });
    await putTask({ queue, task: taskB, client });
    await takeTask({ queue, client, stallDuration: 100 });
    await takeTask({ queue, client, stallDuration: 10000 });
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
    await putStalledTasks({ queue, tasks: stalledTasks, client });
    expect((await getStalledTasks({ queue, client })).length).toBe(0);
    const processingTasks = await getProcessingTasks({ queue, client });
    expect(processingTasks.length).toBe(1);
    expect(processingTasks[0].id).toBe(taskB.id);
  });
});

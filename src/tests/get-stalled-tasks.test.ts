/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import { map } from 'lodash';
import { flushAll, quit } from '../utils/redis';
import { createUuid, sleep } from '../utils/general';
import { putTasks } from '../actions/put-tasks';
import { Task } from '../domain/task';
import { takeTask } from '../actions/take-task';
import { getStalledTasks } from '../actions/get-stalled-tasks';

describe('getStalledTasks', () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = createUuid();

  beforeEach(async () => {
    await flushAll({ client });
  });

  afterAll(async () => {
    await quit({ client });
  });

  it('getStalledTasks gets stalled tasks', async () => {
    const tasks = map(
      Array.from({ length: 10 }),
      (i, index) =>
        ({
          id: `task ${index}`,
          data: 'some-data',
        } as Task),
    );
    await putTasks({ queue, tasks, client });
    const takenTasks = await Promise.all(
      map(tasks, () => takeTask({ queue, client, stallDuration: 100 })),
    );
    expect(takenTasks.length).toBe(10);
    const stalledTasks = await getStalledTasks({ queue, client });
    expect(stalledTasks.length).toBe(0);
    await sleep(150);
    const stalledTasks2 = await getStalledTasks({ queue, client });
    expect(stalledTasks2.length).toBe(10);
  });
});

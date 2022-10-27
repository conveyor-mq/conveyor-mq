import { Redis } from 'ioredis';
import { enqueueTasks } from '../../actions/enqueue-tasks';
import { getStalledTasks } from '../../actions/get-stalled-tasks';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { Task } from '../../domain/tasks/task';
import { createUuid, sleep } from '../../utils/general';
import {
  createClientAndLoadLuaScripts,
  flushAll,
  quit,
} from '../../utils/redis';
import { redisConfig } from '../config';

describe('getStalledTasks', () => {
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

  it('getStalledTasks gets stalled tasks', async () => {
    const tasks = Array.from({ length: 10 }).map(
      (i, index) =>
        ({
          id: `task ${index}`,
          data: 'some-data',
        } as Task),
    );
    await enqueueTasks({ queue, tasks, client });
    const takenTasks = await Promise.all(
      tasks.map(() =>
        takeTaskAndMarkAsProcessing({ queue, client, stallTimeout: 100 }),
      ),
    );
    expect(takenTasks.length).toBe(10);
    const stalledTasks = await getStalledTasks({ queue, client });
    expect(stalledTasks.length).toBe(0);
    await sleep(150);
    const stalledTasks2 = await getStalledTasks({ queue, client });
    expect(stalledTasks2.length).toBe(10);
  });
});

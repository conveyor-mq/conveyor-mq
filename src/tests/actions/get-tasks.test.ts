import { map } from 'lodash';
import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { putTask } from '../../actions/put-task';
import { getTasks } from '../../actions/get-tasks';
import { redisConfig } from '../config';

describe('getTasks', () => {
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

  it('getTasks gets tasks', async () => {
    const puttedTasks = await Promise.all(
      map(Array.from({ length: 10 }), async (i, index) => {
        return putTask({
          queue,
          task: { id: `task ${index}`, data: 'some-data' },
          client,
        });
      }),
    );
    const tasks = await getTasks({
      queue,
      taskIds: map(puttedTasks, (task) => task.id),
      client,
    });
    expect(tasks.length).toBe(10);
  });
  it('getTasks returns empty array for non-existant tasks', async () => {
    const tasks = await getTasks({
      queue,
      taskIds: ['non-existant-id', 'another-non-existant-id'],
      client,
    });
    expect(tasks.length).toBe(0);
  });
});
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { map } from 'lodash';
import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { putTask } from '../../actions/put-task';
import { takeTask } from '../../actions/take-task';
import { getProcessingTasks } from '../../actions/get-processing-tasks';
import { redisConfig } from '../config';

describe('getProcessingTasks', () => {
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

  it('getProcessingTasks gets tasks', async () => {
    const puttedTasks = await Promise.all(
      map(Array.from({ length: 10 }), async (i, index) => {
        return putTask({
          queue,
          task: { id: `task ${index}`, data: 'some-data' },
          client,
        });
      }),
    );
    await Promise.all(
      map(puttedTasks, () => {
        return takeTask({ queue, client });
      }),
    );
    const processingTasks = await getProcessingTasks({ queue, client });
    expect(processingTasks.length).toBe(10);
  });
});

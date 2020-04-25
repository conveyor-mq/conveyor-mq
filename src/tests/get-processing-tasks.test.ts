/* eslint-disable @typescript-eslint/no-non-null-assertion */
import redis from 'redis';
import { map } from 'lodash';
import { flushAll, quit } from '../utils/redis';
import { createUuid } from '../utils/general';
import { putTask } from '../actions/put-task';
import { takeTask } from '../actions/take-task';
import { getProcessingTasks } from '../actions/get-processing-tasks';

describe('getProcessingTasks', () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = createUuid();

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

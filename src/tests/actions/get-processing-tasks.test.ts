import { map } from 'lodash';
import { Redis } from 'ioredis';
import {
  flushAll,
  quit,
  createClientAndLoadLuaScripts,
} from '../../utils/redis';
import { createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { getProcessingTasks } from '../../actions/get-processing-tasks';
import { redisConfig } from '../config';

describe('getProcessingTasks', () => {
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

  it('getProcessingTasks gets tasks', async () => {
    const puttedTasks = await Promise.all(
      map(Array.from({ length: 10 }), async (i, index) => {
        return enqueueTask({
          queue,
          task: { id: `task ${index}`, data: 'some-data' },
          client,
        });
      }),
    );
    await Promise.all(
      map(puttedTasks, () => {
        return takeTaskAndMarkAsProcessing({ queue, client });
      }),
    );
    const processingTasks = await getProcessingTasks({ queue, client });
    expect(processingTasks.length).toBe(10);
  });
});

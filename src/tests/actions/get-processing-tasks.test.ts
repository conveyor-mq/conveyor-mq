import { Redis } from 'ioredis';
import { enqueueTask } from '../../actions/enqueue-task';
import { getProcessingTasks } from '../../actions/get-processing-tasks';
import { takeTaskAndMarkAsProcessing } from '../../actions/take-task-and-mark-as-processing';
import { createUuid } from '../../utils/general';
import {
  createClientAndLoadLuaScripts,
  flushAll,
  quit,
} from '../../utils/redis';
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
      Array.from({ length: 10 }).map(async (i, index) => {
        return enqueueTask({
          queue,
          task: { id: `task ${index}`, data: 'some-data' },
          client,
        });
      }),
    );
    await Promise.all(
      puttedTasks.map(() => {
        return takeTaskAndMarkAsProcessing({ queue, client });
      }),
    );
    const processingTasks = await getProcessingTasks({ queue, client });
    expect(processingTasks.length).toBe(10);
  });
});

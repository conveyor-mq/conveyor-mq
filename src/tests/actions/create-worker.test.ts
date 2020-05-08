import { Redis } from 'ioredis';
import { flushAll, quit, createClient } from '../../utils/redis';
import { sleep, createUuid } from '../../utils/general';
import { enqueueTask } from '../../actions/enqueue-task';
import { createWorker } from '../../actions/create-worker';
import { redisConfig } from '../config';
import { TaskStatuses } from '../../domain/task-statuses';
import { getTask } from '../../actions/get-task';
import { Task } from '../../domain/task';

describe('createQueueHandler', () => {
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

  it('createQueueHandler creates handler', async () => {
    const theTask = { id: 'b', data: 'c' };
    await enqueueTask({ queue, task: theTask, client });
    const handler = await createWorker({
      queue,
      redisConfig,
      handler: ({ task }) => {
        expect(task.id).toBe(theTask.id);
        expect(task.status).toBe(TaskStatuses.Processing);
        return 'some data';
      },
    });
    expect(typeof handler.quit).toBe('function');
    await sleep(100);
    const processedTask = (await getTask({
      queue,
      taskId: theTask.id,
      client,
    })) as Task;
    expect(processedTask.id).toBe(theTask.id);
    expect(processedTask.status).toBe(TaskStatuses.Success);
  });
});

import { enqueueTask } from './enqueue-task';
import { Task } from '../domain/task';
import { enqueueTasks } from './enqueue-tasks';
import { createClient, quit } from '../utils/redis';
import { getTask } from './get-task';
import { getTasks } from './get-tasks';
import { RedisConfig } from '../utils/general';

export const createQueueManager = async ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  const client = await createClient(redisConfig);

  return {
    enqueueTask: (task: Partial<Task>) => enqueueTask({ task, queue, client }),
    enqueueTasks: (tasks: Partial<Task>[]) =>
      enqueueTasks({ tasks, queue, client }),
    getTask: (taskId: string) => getTask({ taskId, queue, client }),
    getTasks: (taskIds: string[]) => getTasks({ taskIds, queue, client }),
    quit: async () => {
      await quit({ client });
    },
  };
};

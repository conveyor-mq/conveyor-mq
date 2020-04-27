import { putTask } from './put-task';
import { Task } from '../domain/task';
import { putTasks } from './put-tasks';
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
    putTask: (task: Partial<Task>) => putTask({ task, queue, client }),
    putTasks: (tasks: Partial<Task>[]) => putTasks({ tasks, queue, client }),
    getTask: (taskId: string) => getTask({ taskId, queue, client }),
    getTasks: (taskIds: string[]) => getTasks({ taskIds, queue, client }),
    quit: async () => {
      await quit({ client });
    },
  };
};

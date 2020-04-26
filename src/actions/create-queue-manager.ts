import { putTask } from './put-task';
import { Task } from '../domain/task';
import { putTasks } from './put-tasks';
import { registerHandler } from './register-handler';
import { createClient } from '../utils/redis';
import { getTask } from './get-task';
import { getTasks } from './get-tasks';

export const createQueueManager = async ({
  queue,
  redis,
}: {
  queue: string;
  redis: { host: string; port: number };
}) => {
  const [producerClient, consumerClient] = await Promise.all([
    createClient(redis),
    createClient(redis),
  ]);
  return {
    registerHandler: ({
      handler,
      concurrency = 1,
      stallDuration = 10000,
    }: {
      handler: ({ task }: { task: Task }) => any | Promise<any>;
      concurrency?: number;
      stallDuration?: number;
    }) =>
      registerHandler({
        queue,
        handler,
        client: consumerClient,
        concurrency,
        stallDuration,
      }),
    putTask: ({ task }: { task: Task }) =>
      putTask({ task, queue, client: producerClient }),
    putTasks: ({ tasks }: { tasks: Task[] }) =>
      putTasks({ tasks, queue, client: producerClient }),
    getTask: ({ taskId }: { taskId: string }) =>
      getTask({ taskId, queue, client: producerClient }),
    getTasks: ({ taskIds }: { taskIds: string[] }) =>
      getTasks({ taskIds, queue, client: producerClient }),
  };
};

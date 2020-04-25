import { RedisClient } from 'redis';
import { Task } from '../domain/task';
import { getTasks } from './get-tasks';

export const getTask = async ({
  queue,
  taskId,
  client,
}: {
  queue: string;
  taskId: string;
  client: RedisClient;
}): Promise<Task | null> => {
  const [task] = await getTasks({ queue, taskIds: [taskId], client });
  return task;
};

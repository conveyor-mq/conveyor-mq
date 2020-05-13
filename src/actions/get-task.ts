import { Redis } from 'ioredis';
import { getTasks } from './get-tasks';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const getTask = async ({
  queue,
  taskId,
  client,
}: {
  queue: string;
  taskId: string;
  client: Redis;
}): Promise<Task | null> => {
  const [task] = await getTasks({ queue, taskIds: [taskId], client });
  return task || null;
};

import { Redis } from 'ioredis';
import { getTasksById } from './get-tasks-by-id';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const getTaskById = async ({
  queue,
  taskId,
  client,
}: {
  queue: string;
  taskId: string;
  client: Redis;
}): Promise<Task | null> => {
  const [task] = await getTasksById({ queue, taskIds: [taskId], client });
  return task || null;
};

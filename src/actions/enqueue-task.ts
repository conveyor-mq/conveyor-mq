import { Redis } from 'ioredis';
import { enqueueTasks } from './enqueue-tasks';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const enqueueTask = async ({
  queue,
  task,
  client,
}: {
  queue: string;
  task: Partial<Task>;
  client: Redis;
}): Promise<Task> => {
  const [queuedTask] = await enqueueTasks({ queue, tasks: [task], client });
  return queuedTask;
};

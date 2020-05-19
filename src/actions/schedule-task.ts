import { Redis } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { scheduleTasks } from './schedule-tasks';

/**
 * @ignore
 */
export const scheduleTask = async ({
  task,
  queue,
  client,
}: {
  task: Partial<Task>;
  queue: string;
  client: Redis;
}): Promise<Task> => {
  const [scheduledTask] = await scheduleTasks({ queue, tasks: [task], client });
  return scheduledTask;
};

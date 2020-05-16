import { Redis } from 'ioredis';
import { markTasksFailed } from './mark-tasks-failed';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const markTaskFailed = async ({
  task,
  queue,
  client,
  error,
  asOf,
}: {
  task: Task;
  queue: string;
  client: Redis;
  error?: any;
  asOf: Date;
}) => {
  const [failedTask] = await markTasksFailed({
    tasksAndErrors: [{ task, error }],
    queue,
    client,
    asOf,
  });
  return failedTask;
};

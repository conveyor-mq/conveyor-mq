import { Redis, Pipeline } from 'ioredis';
import { markTasksFailed, markTasksFailedMulti } from './mark-tasks-failed';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const markTaskFailedMulti = async ({
  task,
  queue,
  multi,
  error,
  remove,
}: {
  task: Task;
  queue: string;
  multi: Pipeline;
  error?: any;
  remove?: boolean;
}) => {
  const [failedTask] = await markTasksFailedMulti({
    tasksAndErrors: [{ task, error }],
    queue,
    multi,
    remove,
  });
  return failedTask;
};

/**
 * @ignore
 */
export const markTaskFailed = async ({
  task,
  queue,
  client,
  error,
  remove,
}: {
  task: Task;
  queue: string;
  client: Redis;
  error?: any;
  remove?: boolean;
}) => {
  const [failedTask] = await markTasksFailed({
    tasksAndErrors: [{ task, error }],
    queue,
    client,
    remove,
  });
  return failedTask;
};

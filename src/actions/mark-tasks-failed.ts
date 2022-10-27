import { ChainableCommander, Redis } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { exec } from '../utils/redis';
import { markTaskFailedMulti } from './mark-task-failed';

/**
 * @ignore
 */
export const markTasksFailedMulti = ({
  tasksAndErrors,
  queue,
  multi,
  remove,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  multi: ChainableCommander;
  remove?: boolean;
}): Task[] => {
  const failedTasks = tasksAndErrors.map(({ task, error }) =>
    markTaskFailedMulti({ task, queue, multi, error, remove }),
  );
  return failedTasks;
};

/**
 * @ignore
 */
export const markTasksFailed = async ({
  tasksAndErrors,
  queue,
  client,
  remove,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  client: Redis;
  remove?: boolean;
}): Promise<Task[]> => {
  const multi = client.multi();
  const failedTasks = markTasksFailedMulti({
    tasksAndErrors,
    queue,
    multi,
    remove,
  });
  await exec(multi);
  return failedTasks;
};

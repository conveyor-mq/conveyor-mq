import { Redis, Pipeline } from 'ioredis';
import { map } from 'lodash';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
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
  multi: Pipeline;
  remove?: boolean;
}): Task[] => {
  const failedTasks = map(tasksAndErrors, ({ task, error }) =>
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

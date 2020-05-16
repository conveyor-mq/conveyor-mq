import { Redis } from 'ioredis';
import { map, filter } from 'lodash';
import moment from 'moment';
import { enqueueStalledTasks } from './enqueue-stalled-tasks';
import { markTasksFailed } from './mark-tasks-failed';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const handleStalledTasks = async ({
  queue,
  client,
  tasks,
}: {
  queue: string;
  client: Redis;
  tasks: Task[];
}) => {
  const results = map(tasks, (task) => {
    return {
      task,
      retryLimitReached:
        task.retryLimit && (task.retries || 0) >= task.retryLimit,
      stallRetryLimitReached:
        task.stallRetryLimit &&
        (task.stallRetries || 0) >= task.stallRetryLimit,
    };
  });
  const tasksToReQueue = map(
    filter(
      results,
      ({ retryLimitReached, stallRetryLimitReached }) =>
        !retryLimitReached && !stallRetryLimitReached,
    ),
    (result) => result.task,
  );
  const tasksAndErrors = map(
    filter(
      results,
      ({ retryLimitReached, stallRetryLimitReached }) =>
        !!retryLimitReached || !!stallRetryLimitReached,
    ),
    ({ task, retryLimitReached, stallRetryLimitReached }) => {
      // eslint-disable-next-line no-nested-ternary
      const error = retryLimitReached
        ? 'Retry limit reached'
        : stallRetryLimitReached
        ? 'Stall retry limit reached'
        : '';
      return { task, error };
    },
  );
  const [failedTasks, reQueuedTasks] = await Promise.all([
    markTasksFailed({ tasksAndErrors, queue, client, asOf: moment() }),
    enqueueStalledTasks({ queue, tasks: tasksToReQueue, client }),
  ]);
  return { failedTasks, reQueuedTasks };
};

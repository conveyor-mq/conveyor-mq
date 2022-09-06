import { Redis } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { enqueueStalledTasks } from './enqueue-stalled-tasks';
import { markTasksFailed } from './mark-tasks-failed';

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
  const results = tasks.map((task) => {
    return {
      task,
      retryLimitReached:
        task.retryLimit && (task.retries || 0) >= task.retryLimit,
      stallRetryLimitReached:
        task.stallRetryLimit &&
        (task.stallRetries || 0) >= task.stallRetryLimit,
    };
  });
  const tasksToReQueue = results
    .filter(
      ({ retryLimitReached, stallRetryLimitReached }) =>
        !retryLimitReached && !stallRetryLimitReached,
    )
    .map((result) => result.task);
  const tasksAndErrors = results
    .filter(
      ({ retryLimitReached, stallRetryLimitReached }) =>
        !!retryLimitReached || !!stallRetryLimitReached,
    )
    .map(({ task, retryLimitReached, stallRetryLimitReached }) => {
      // eslint-disable-next-line no-nested-ternary
      const error = retryLimitReached
        ? 'Retry limit reached'
        : stallRetryLimitReached
        ? 'Stall retry limit reached'
        : '';
      return { task, error };
    });
  const [failedTasks, reQueuedTasks] = await Promise.all([
    markTasksFailed({ tasksAndErrors, queue, client }),
    enqueueStalledTasks({ queue, tasks: tasksToReQueue, client }),
  ]);
  return { failedTasks, reQueuedTasks };
};

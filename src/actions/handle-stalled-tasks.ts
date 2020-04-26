import { Redis } from 'ioredis';
import { map, filter } from 'lodash';
import moment from 'moment';
import { Task } from '../domain/task';
import { putStalledTasks } from './put-stalled-tasks';
import { markTasksFailed } from './mark-tasks-failed';

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
      maxAttemptCountExceeded:
        task.maxAttemptCount &&
        (task.attemptCount || 1) >= task.maxAttemptCount,
      maxErrorCountExceeded:
        task.maxErrorCount && (task.errorCount || 0) >= task.maxErrorCount,
    };
  });
  const tasksToReQueue = map(
    filter(
      results,
      ({ maxAttemptCountExceeded, maxErrorCountExceeded }) =>
        !maxAttemptCountExceeded && !maxErrorCountExceeded,
    ),
    (result) => result.task,
  );
  const tasksAndErrors = map(
    filter(
      results,
      ({ maxAttemptCountExceeded, maxErrorCountExceeded }) =>
        !!maxAttemptCountExceeded || !!maxErrorCountExceeded,
    ),
    ({ task, maxAttemptCountExceeded, maxErrorCountExceeded }) => {
      // eslint-disable-next-line no-nested-ternary
      const error = maxAttemptCountExceeded
        ? 'Max attempt count exceeded'
        : maxErrorCountExceeded
        ? 'Max error count exceed'
        : '';
      return { task, error };
    },
  );
  const [failedTasks, reQueuedTasks] = await Promise.all([
    markTasksFailed({ tasksAndErrors, queue, client, asOf: moment() }),
    putStalledTasks({ queue, tasks: tasksToReQueue, client }),
  ]);
  return { failedTasks, reQueuedTasks };
};

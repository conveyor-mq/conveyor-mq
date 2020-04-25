import { RedisClient } from 'redis';
import moment, { Moment } from 'moment';
import { Task } from '../domain/task';
import { hasTaskExpired } from './has-task-expired';
import { markTaskSuccess } from './mark-task-success';
import { putTask } from './put-task';
import { markTaskFailed } from './mark-task-failed';
import { sleep } from '../utils';
import { linear } from '../utils/retry-strategies';

export type getRetryDelayType = ({
  task,
}: {
  task: Task;
}) => number | Promise<number>;

export const handleTask = async ({
  task,
  queue,
  client,
  handler,
  asOf,
  getRetryDelay = linear(),
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  handler: ({ task }: { task: Task }) => any;
  asOf: Moment;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
}): Promise<any | null> => {
  if (hasTaskExpired({ task, asOf })) {
    return null;
  }
  const maxAttemptsExceeded =
    task.maxAttempts && (task.attemptCount || 1) > task.maxAttempts;
  if (maxAttemptsExceeded) {
    return null;
  }
  try {
    const result = await handler({ task });
    await markTaskSuccess({
      task,
      queue,
      client,
      result,
      asOf: moment(),
    });
    if (onTaskSuccess) onTaskSuccess({ task });
    return result;
  } catch (e) {
    if (onTaskError) onTaskError({ task });
    const shouldRetryTask =
      task.maxAttempts &&
      task.attemptCount &&
      task.attemptCount < task.maxAttempts;
    if (shouldRetryTask) {
      const delay = await getRetryDelay({ task });
      // Use delayed task instead of sleeping.
      await sleep(delay);
      await putTask({
        task: { ...task, processingEndedOn: moment() },
        queue,
        client,
      });
      return null;
    }
    await markTaskFailed({
      task,
      queue,
      client,
      error: e.message,
      asOf: moment(),
    });
    if (onTaskFailed) onTaskFailed({ task });
    return e;
  }
};

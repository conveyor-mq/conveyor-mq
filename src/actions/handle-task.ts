import { RedisClient } from 'redis';
import moment, { Moment } from 'moment';
import { Task } from '../domain/task';
import { hasTaskExpired } from './has-task-expired';
import { markTaskSuccess } from './mark-task-success';
import { putTask } from './put-task';
import { markTaskFailed } from './mark-task-failed';
import { linear } from '../utils/retry-strategies';
import { sleep } from '../utils/general';

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
    console.warn(`Not handling task ${task.id}. Task has expired.`);
    return null;
  }
  const maxAttemptCountExceeded =
    task.maxAttemptCount && (task.attemptCount || 1) > task.maxAttemptCount;
  if (maxAttemptCountExceeded) {
    console.warn(`Not handling task ${task.id}. Max attempts count exceeded.`);
    return null;
  }
  const maxErrorCountExceeded =
    task.maxErrorCount && (task.errorCount || 0) > task.maxErrorCount;
  if (maxErrorCountExceeded) {
    console.warn(`Not handling task ${task.id}. Max error count exceeded.`);
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
    const willMaxAttemptCountBeExceeded =
      task.maxAttemptCount &&
      task.attemptCount &&
      task.attemptCount >= task.maxAttemptCount;
    const willMaxErrorCountBeExceeded =
      task.maxErrorCount && (task.errorCount || 0) >= task.maxErrorCount;
    if (!willMaxErrorCountBeExceeded && !willMaxAttemptCountBeExceeded) {
      const delay = await getRetryDelay({ task });
      // Use delayed task instead of sleeping.
      await sleep(delay);
      await putTask({
        task: {
          ...task,
          errorCount: (task.errorCount || 0) + 1,
          processingEndedOn: moment(),
        },
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

import { RedisClient } from 'redis';
import moment, { Moment } from 'moment';
import { Task } from '../domain/task';
import { hasTaskExpired } from './has-task-expired';
import { markTaskSuccess } from './mark-task-success';
import { putTask } from './put-task';
import { markTaskFailed } from './mark-task-failed';

export const handleTask = async ({
  task,
  queue,
  client,
  handler,
  asOf,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  handler: ({ task }: { task: Task }) => any;
  asOf: Moment;
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
    return result;
  } catch (e) {
    const shouldRetryTask =
      task.maxAttempts &&
      task.attemptCount &&
      task.attemptCount < task.maxAttempts;
    if (shouldRetryTask) {
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
    return e;
  }
};

import { RedisClient } from 'redis';
import moment, { Moment } from 'moment';
import { Task } from '../domain/task';
import { hasTaskExpired } from './has-task-expired';
import { markTaskProcessing } from './mark-task-processing';
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
  if (!task) {
    console.warn('No task provided to handle.');
    return null;
  }
  if (hasTaskExpired({ task, asOf })) {
    console.warn('Not handling expired task.');
    return null;
  }
  const maxAttemptsExceeded =
    task.maxAttempts && (task.attemptCount || 0) >= task.maxAttempts;
  if (maxAttemptsExceeded) {
    console.warn('Task has exceeded its maxAttempts.');
    return null;
  }
  const processingTask = await markTaskProcessing({
    task,
    queue,
    client,
    asOf: moment(),
    attemptNumber: (task.attemptCount || 0) + 1,
  });
  try {
    const result = await handler({ task: processingTask });
    await markTaskSuccess({
      task: processingTask,
      queue,
      client,
      result,
      asOf: moment(),
    });
    return result;
  } catch (e) {
    const maxAttemptsExceededAfterProcessing =
      processingTask.maxAttempts &&
      processingTask.attemptCount &&
      processingTask.attemptCount < processingTask.maxAttempts;
    if (maxAttemptsExceededAfterProcessing) {
      await putTask({
        task: { ...processingTask, processingEndedOn: moment() },
        queue,
        client,
      });
      return null;
    }

    await markTaskFailed({
      task: processingTask,
      queue,
      client,
      error: e.message,
      asOf: moment(),
    });
    return e;
  }
};

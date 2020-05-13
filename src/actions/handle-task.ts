import { Redis } from 'ioredis';
import moment, { Moment } from 'moment';
import pTimeout from 'p-timeout';
import { hasTaskExpired } from './has-task-expired';
import { markTaskSuccess } from './mark-task-success';
import { enqueueTask } from './enqueue-task';
import { markTaskFailed } from './mark-task-failed';
import { getRetryDelayDefault } from '../utils/retry-strategies';
import { sleep } from '../utils/general';
import { getQueueTaskErrorChannel } from '../utils/keys';
import { Task } from '../domain/tasks/task';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';

/**
 * @ignore
 */
export type getRetryDelayType = ({
  task,
}: {
  task: Task;
}) => number | Promise<number>;

/**
 * @ignore
 */
export const handleTask = async ({
  task,
  queue,
  client,
  handler,
  asOf,
  getRetryDelay = getRetryDelayDefault,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
}: {
  task: Task;
  queue: string;
  client: Redis;
  handler: ({ task }: { task: Task }) => any;
  asOf: Moment;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
}): Promise<any | null> => {
  const maxAttemptCountExceeded =
    task.maxAttemptCount && (task.attemptCount || 1) > task.maxAttemptCount;
  const maxErrorCountExceeded =
    task.maxErrorCount && (task.errorCount || 0) > task.maxErrorCount;
  const hasExpired = hasTaskExpired({ task, asOf });
  if (maxAttemptCountExceeded || maxErrorCountExceeded || hasExpired) {
    const failedTask = await markTaskFailed({
      task,
      queue,
      client,
      error: hasExpired
        ? 'Task has expired'
        : `Task max ${
            maxAttemptCountExceeded ? 'attempt' : 'error'
          } count exceeded`,
      asOf: moment(),
    });
    if (onTaskFailed) onTaskFailed({ task: failedTask });
    return null;
  }
  try {
    const result = await (task.executionTimeout
      ? pTimeout(handler({ task }), task.executionTimeout)
      : handler({ task }));
    const successfulTask = await markTaskSuccess({
      task,
      queue,
      client,
      result,
      asOf: moment(),
    });
    if (onTaskSuccess) onTaskSuccess({ task: successfulTask });
    return result;
  } catch (e) {
    if (onTaskError) onTaskError({ task });
    client.publish(
      getQueueTaskErrorChannel({ queue }),
      serializeEvent({ createdAt: moment(), type: EventTypes.TaskError, task }),
    );
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
      await enqueueTask({
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
    const failedTask = await markTaskFailed({
      task,
      queue,
      client,
      error: e.message,
      asOf: moment(),
    });
    if (onTaskFailed) onTaskFailed({ task: failedTask });
    return null;
  }
};

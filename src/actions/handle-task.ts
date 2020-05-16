import { Redis } from 'ioredis';
import moment, { Moment } from 'moment';
import pTimeout from 'p-timeout';
import { find } from 'lodash';
import { hasTaskExpired } from './has-task-expired';
import { markTaskSuccess } from './mark-task-success';
import { enqueueTask } from './enqueue-task';
import { markTaskFailed } from './mark-task-failed';
import { getRetryDelayDefault } from '../utils/retry-strategies';
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
  const retryLimitReached =
    task.retryLimit !== undefined &&
    task.retryLimit !== null &&
    (task.retries || 0) > task.retryLimit;
  const errorRetryLimitReached =
    task.errorRetryLimit !== undefined &&
    task.errorRetryLimit !== null &&
    (task.errorRetries || 0) > task.errorRetryLimit;
  const stallRetryLimitReached =
    task.stallRetryLimit !== undefined &&
    task.stallRetryLimit !== null &&
    (task.stallRetries || 0) > task.stallRetryLimit;
  const hasExpired = hasTaskExpired({ task, asOf });
  if (
    retryLimitReached ||
    errorRetryLimitReached ||
    stallRetryLimitReached ||
    hasExpired
  ) {
    const errorMessages = [
      {
        condition: !!hasExpired,
        message: 'Task has expired',
      },
      {
        condition: !!errorRetryLimitReached,
        message: 'Error retry limit reached',
      },
      {
        condition: !!stallRetryLimitReached,
        message: 'Stall retry limit reached',
      },
      {
        condition: !!retryLimitReached,
        message: 'Retry limit reached',
      },
    ];
    const failedTask = await markTaskFailed({
      task,
      queue,
      client,
      error: find(errorMessages, ({ condition }) => !!condition)?.message,
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
    const willRetryLimitBeReached =
      task.retryLimit !== undefined &&
      task.retryLimit !== null &&
      (task.retries || 0) >= task.retryLimit;
    const willErrorRetryLimitBeReached =
      task.errorRetryLimit !== undefined &&
      task.errorRetryLimit !== null &&
      (task.errorRetries || 0) >= task.errorRetryLimit;
    const willStallRetryLimitBeReached =
      task.stallRetryLimit !== undefined &&
      task.stallRetryLimit !== null &&
      (task.stallRetries || 0) >= task.stallRetryLimit;
    if (
      !willRetryLimitBeReached &&
      !willErrorRetryLimitBeReached &&
      !willStallRetryLimitBeReached
    ) {
      const retryDelay = await getRetryDelay({ task });
      await enqueueTask({
        task: {
          ...task,
          enqueueAfter: retryDelay
            ? moment().add(retryDelay, 'milliseconds')
            : undefined,
          retries: (task.retries || 0) + 1,
          errorRetries: (task.errorRetries || 0) + 1,
          processingEndedAt: moment(),
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
      error:
        e instanceof pTimeout.TimeoutError
          ? 'Task execution duration exceeded executionTimeout'
          : e.message,
      asOf: moment(),
    });
    if (onTaskFailed) onTaskFailed({ task: failedTask });
    return null;
  }
};

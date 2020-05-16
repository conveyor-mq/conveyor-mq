import { Redis } from 'ioredis';
import moment from 'moment';
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
import { updateTask as updateTaskAction } from './update-task';
import { updateTaskProgress as updateTaskProgressAction } from './update-task-progress';

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
export type TaskSuccessCb = ({
  task,
  result,
}: {
  task: Task;
  result: any;
}) => any;
/**
 * @ignore
 */
export type TaskErrorCb = ({ task, error }: { task: Task; error: any }) => any;
/**
 * @ignore
 */
export type TaskFailedCb = ({ task, error }: { task: Task; error: any }) => any;
/**
 * @ignore
 */
export type Handler = ({
  task,
  updateTaskProgress,
  updateTask,
}: {
  task: Task;
  updateTaskProgress: (progress: any) => Promise<Task>;
  updateTask: ({ task }: { task: Task }) => Promise<Task>;
}) => any;

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
  handler: Handler;
  asOf: Date;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: TaskSuccessCb;
  onTaskError?: TaskErrorCb;
  onTaskFailed?: TaskFailedCb;
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
    const error = find(errorMessages, ({ condition }) => !!condition)?.message;
    const failedTask = await markTaskFailed({
      task,
      queue,
      client,
      error,
      asOf: new Date(),
    });
    if (onTaskFailed) onTaskFailed({ task: failedTask, error });
    return null;
  }
  try {
    const updateTask = async ({ task: taskToUpdate }: { task: Task }) => {
      const updatedTask = await updateTaskAction({
        task: taskToUpdate,
        queue,
        client,
      });
      // eslint-disable-next-line no-param-reassign
      task = updatedTask;
      return updatedTask;
    };
    const updateTaskProgress = async (progress: any) => {
      const updatedTask = await updateTaskProgressAction({
        task,
        progress,
        queue,
        client,
      });
      // eslint-disable-next-line no-param-reassign
      task = updatedTask;
      return updatedTask;
    };
    const handlerFunction = () =>
      handler({ task, updateTaskProgress, updateTask });
    const result = await (task.executionTimeout
      ? pTimeout(handlerFunction(), task.executionTimeout)
      : handlerFunction());
    const successfulTask = await markTaskSuccess({
      task,
      queue,
      client,
      result,
      asOf: new Date(),
    });
    if (onTaskSuccess) onTaskSuccess({ task: successfulTask, result });
    return result;
  } catch (e) {
    const error =
      e instanceof pTimeout.TimeoutError
        ? 'Task execution duration exceeded executionTimeout'
        : e.message;
    if (onTaskError) onTaskError({ task, error });
    client.publish(
      getQueueTaskErrorChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventTypes.TaskError,
        task,
      }),
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
            ? moment().add(retryDelay, 'milliseconds').toDate()
            : undefined,
          retries: (task.retries || 0) + 1,
          errorRetries: (task.errorRetries || 0) + 1,
          processingEndedAt: new Date(),
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
      error,
      asOf: new Date(),
    });
    if (onTaskFailed) onTaskFailed({ task: failedTask, error });
    return null;
  }
};

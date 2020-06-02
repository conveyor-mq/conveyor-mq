import { Redis, Pipeline } from 'ioredis';
import moment from 'moment';
import pTimeout from 'p-timeout';
import { find } from 'lodash';
import { hasTaskExpired } from './has-task-expired';
import { markTaskSuccessMulti } from './mark-task-success';
import { enqueueTaskMulti } from './enqueue-task';
import { markTaskFailedMulti } from './mark-task-failed';
import { getRetryDelayDefault } from '../utils/retry-strategies';
import { getQueueTaskErrorChannel, getProcessingListKey } from '../utils/keys';
import { Task } from '../domain/tasks/task';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';
import { updateTask as updateTaskAction } from './update-task';
import { updateTaskProgress as updateTaskProgressAction } from './update-task-progress';
import { exec } from '../utils/redis';

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
  updateTask: (taskUpdateData: Partial<Task>) => Promise<Task>;
}) => any;
/**
 * @ignore
 */
interface Response {
  name: 'taskSuccess' | 'taskError' | 'taskFailed';
  params: {
    task: Task;
    error?: any;
    result?: any;
  };
}

/**
 * @ignore
 */
export const handleTaskMulti = async ({
  task,
  queue,
  client,
  multi,
  handler,
  asOf,
  getRetryDelay = getRetryDelayDefault,
  removeOnSuccess,
  removeOnFailed,
}: {
  task: Task;
  queue: string;
  client: Redis;
  multi: Pipeline;
  handler: Handler;
  asOf: Date;
  getRetryDelay?: getRetryDelayType;
  removeOnSuccess?: boolean;
  removeOnFailed?: boolean;
}): Promise<Response> => {
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
    const failedTask = markTaskFailedMulti({
      task,
      queue,
      multi,
      error,
      remove: removeOnFailed,
    });
    return {
      name: 'taskFailed',
      params: { task: failedTask, error },
    };
  }
  try {
    const updateTask = async (taskUpdateData: Partial<Task>) => {
      const updatedTask = await updateTaskAction({
        taskId: task.id,
        taskUpdateData,
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
    const successfulTask = await markTaskSuccessMulti({
      task,
      queue,
      multi,
      result,
      asOf: new Date(),
      remove: removeOnSuccess,
    });
    return {
      name: 'taskSuccess',
      params: { task: successfulTask, result },
    };
  } catch (e) {
    const error =
      e instanceof pTimeout.TimeoutError
        ? 'Task execution duration exceeded executionTimeout'
        : e.message;
    multi.lrem(getProcessingListKey({ queue }), 1, task.id);
    multi.publish(
      getQueueTaskErrorChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventType.TaskError,
        task: { ...task, error },
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
      const taskToEnqueue = {
        ...task,
        enqueueAfter: retryDelay
          ? moment().add(retryDelay, 'milliseconds').toDate()
          : undefined,
        retries: (task.retries || 0) + 1,
        errorRetries: (task.errorRetries || 0) + 1,
        processingEndedAt: new Date(),
      };
      enqueueTaskMulti({ task: taskToEnqueue, queue, multi });
      return {
        name: 'taskError',
        params: {
          error,
          task: taskToEnqueue,
        },
      };
    }
    const failedTask = await markTaskFailedMulti({
      task,
      queue,
      multi,
      error,
      remove: removeOnFailed,
    });
    return {
      name: 'taskFailed',
      params: { task: failedTask, error },
    };
  }
};

/**
 * @ignore
 */
export const handleCallbacks = ({
  response,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
}: {
  response: Response;
  onTaskSuccess?: TaskSuccessCb;
  onTaskError?: TaskErrorCb;
  onTaskFailed?: TaskFailedCb;
}) => {
  const {
    params: { task, result, error },
  } = response;
  const callbacks: { [key: string]: any } = {
    taskSuccess: () =>
      onTaskSuccess &&
      onTaskSuccess({
        task,
        result,
      }),
    taskError: () => onTaskError && onTaskError({ task, error }),
    taskFailed: () => {
      if (onTaskFailed) onTaskFailed({ task, error });
      if (onTaskError) onTaskError({ task, error });
    },
  };
  const callback = callbacks[response.name];
  callback();
};

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
  removeOnSuccess,
  removeOnFailed,
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
  removeOnSuccess?: boolean;
  removeOnFailed?: boolean;
}): Promise<any | null> => {
  const multi = client.multi();
  const response = await handleTaskMulti({
    task,
    queue,
    client,
    multi,
    handler,
    asOf,
    getRetryDelay,
    removeOnSuccess,
    removeOnFailed,
  });
  await exec(multi);
  await handleCallbacks({ response, onTaskSuccess, onTaskError, onTaskFailed });
  return response.name === 'taskSuccess' ? response.params.result : null;
};

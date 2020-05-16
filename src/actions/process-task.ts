import {
  clearIntervalAsync,
  setIntervalAsync,
} from 'set-interval-async/dynamic';
import { Redis } from 'ioredis';
import { acknowledgeTask } from './acknowledge-task';
import {
  handleTask,
  getRetryDelayType,
  TaskSuccessCb,
  TaskErrorCb,
  TaskFailedCb,
  Handler,
} from './handle-task';
import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const processTask = async ({
  task,
  queue,
  client,
  handler,
  stallTimeout,
  taskAcknowledgementInterval,
  getRetryDelay,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
}: {
  task: Task;
  queue: string;
  client: Redis;
  handler: Handler;
  stallTimeout: number;
  taskAcknowledgementInterval: number;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: TaskSuccessCb;
  onTaskError?: TaskErrorCb;
  onTaskFailed?: TaskFailedCb;
}) => {
  const timer = setIntervalAsync(async () => {
    await acknowledgeTask({
      taskId: task.id,
      queue,
      client,
      ttl: stallTimeout,
    });
  }, taskAcknowledgementInterval);
  const result = await handleTask({
    task,
    queue,
    handler,
    client,
    asOf: new Date(),
    getRetryDelay,
    onTaskSuccess,
    onTaskError,
    onTaskFailed,
  });
  await clearIntervalAsync(timer);
  return result;
};

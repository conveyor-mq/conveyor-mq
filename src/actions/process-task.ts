import {
  clearIntervalAsync,
  setIntervalAsync,
} from 'set-interval-async/dynamic';
import moment from 'moment';
import { Redis } from 'ioredis';
import { acknowledgeTask } from './acknowledge-task';
import {
  handleTask,
  getRetryDelayType,
  TaskSuccessCb,
  TaskErrorCb,
  TaskFailedCb,
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
  handler: ({ task }: { task: Task }) => any;
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
    asOf: moment(),
    getRetryDelay,
    onTaskSuccess,
    onTaskError,
    onTaskFailed,
  });
  await clearIntervalAsync(timer);
  return result;
};

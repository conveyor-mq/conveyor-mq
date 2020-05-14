import {
  clearIntervalAsync,
  setIntervalAsync,
} from 'set-interval-async/dynamic';
import moment from 'moment';
import { Redis } from 'ioredis';
import { acknowledgeTask } from './acknowledge-task';
import { handleTask, getRetryDelayType } from './handle-task';
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
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
}) => {
  const timer = setIntervalAsync(async () => {
    await acknowledgeTask({
      taskId: task.id,
      queue,
      client,
      ttl: stallTimeout,
    });
  }, stallTimeout / 2);
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

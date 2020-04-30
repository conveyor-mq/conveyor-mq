import { Redis } from 'ioredis';
import moment from 'moment';
import {
  setIntervalAsync,
  clearIntervalAsync,
} from 'set-interval-async/dynamic';
import { takeTask } from './take-task';
import { handleTask, getRetryDelayType } from './handle-task';
import { Task } from '../domain/task';
import { acknowledgeTask } from './acknowledge-task';

export const processTask = async ({
  queue,
  client,
  stallDuration,
  handler,
  getRetryDelay,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
}: {
  queue: string;
  client: Redis;
  stallDuration: number;
  handler: ({ task }: { task: Task }) => any;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
}) => {
  const task = await takeTask({
    queue,
    client,
    stallDuration,
  });
  if (task) {
    const timer = setIntervalAsync(async () => {
      await acknowledgeTask({
        taskId: task.id,
        queue,
        client,
        ttl: stallDuration,
      });
    }, stallDuration / 2);
    await handleTask({
      task,
      queue,
      client,
      asOf: moment(),
      handler,
      getRetryDelay,
      onTaskSuccess,
      onTaskError,
      onTaskFailed,
    });
    await clearIntervalAsync(timer);
  }
  return task;
};

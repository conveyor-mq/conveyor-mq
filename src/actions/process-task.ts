import { Redis } from 'ioredis';
import moment from 'moment';
import { takeTask, handleTask } from '..';
import { Task } from '../domain/task';
import { getRetryDelayType } from './handle-task';

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
  }
  return task;
};

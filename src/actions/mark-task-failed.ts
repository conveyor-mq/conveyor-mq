import { RedisClient } from 'redis';
import { Moment } from 'moment';
import { Task } from '../domain/task';
import { updateTask } from './update-task';
import { TaskStatuses } from '../domain/task-statuses';

export const markTaskFailed = async ({
  task,
  queue,
  client,
  error,
  asOf,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  error?: any;
  asOf: Moment;
}) => {
  return updateTask({
    task: {
      ...task,
      processingEndedOn: asOf,
      status: TaskStatuses.Failed,
      error,
    },
    queue,
    client,
  });
};

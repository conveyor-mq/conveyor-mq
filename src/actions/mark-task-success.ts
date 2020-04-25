import { RedisClient } from 'redis';
import { Moment } from 'moment';
import { Task } from '../domain/task';
import { updateTask } from './update-task';
import { TaskStatuses } from '../domain/task-statuses';

export const markTaskSuccess = async ({
  task,
  queue,
  client,
  result,
  asOf,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  result?: any;
  asOf: Moment;
}) => {
  return updateTask({
    task: {
      ...task,
      processingEndedOn: asOf,
      status: TaskStatuses.Success,
      result,
    },
    queue,
    client,
  });
};

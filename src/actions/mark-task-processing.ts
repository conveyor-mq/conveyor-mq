import { RedisClient } from 'redis';
import { Moment } from 'moment';
import { Task } from '../domain/task';
import { updateTask } from './update-task';
import { TaskStatuses } from '../domain/task-statuses';

export const markTaskProcessing = async ({
  task,
  queue,
  client,
  asOf,
  attemptNumber,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
  asOf: Moment;
  attemptNumber: number;
}) => {
  return updateTask({
    task: {
      ...task,
      attemptCount: attemptNumber,
      processingStartedOn: asOf,
      processingEndedOn: undefined,
      status: TaskStatuses.Processing,
    },
    queue,
    client,
  });
};

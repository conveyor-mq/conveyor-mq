import { RedisClient } from 'redis';
import { Moment } from 'moment';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import { getTaskKey, getProcessingListKey } from '../utils/keys';
import { serializeTask } from '../domain/serialize-task';

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
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const processingListKey = getProcessingListKey({ queue });
  const successfulTask: Task = {
    ...task,
    processingEndedOn: asOf,
    status: TaskStatuses.Success,
    result,
  };
  const multi = client.multi();
  multi.set(taskKey, serializeTask(successfulTask));
  multi.lrem(processingListKey, 1, task.id);
  return new Promise((resolve, reject) => {
    multi.exec((error, multiResult) =>
      error || multiResult === null
        ? reject(error || 'Multi command failed.')
        : resolve(successfulTask),
    );
  });
};

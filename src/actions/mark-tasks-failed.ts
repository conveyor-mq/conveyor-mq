import { Redis } from 'ioredis';
import { Moment } from 'moment';
import { map } from 'lodash';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import { getTaskKey, getProcessingListKey } from '../utils/keys';
import { serializeTask } from '../domain/serialize-task';

export const markTasksFailed = async ({
  tasksAndErrors,
  queue,
  client,
  asOf,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  client: Redis;
  asOf: Moment;
}): Promise<Task[]> => {
  const processingListKey = getProcessingListKey({ queue });
  const multi = client.multi();
  const failedTasks = map(tasksAndErrors, ({ task, error }) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const failedTask: Task = {
      ...task,
      processingEndedOn: asOf,
      status: TaskStatuses.Failed,
      error,
    };
    multi.set(taskKey, serializeTask(failedTask));
    multi.lrem(processingListKey, 1, task.id);
    return failedTask;
  });
  return new Promise((resolve, reject) => {
    multi.exec((multiError, multiResult) =>
      multiError || multiResult === null
        ? reject(multiError || 'Multi command failed.')
        : resolve(failedTasks),
    );
  });
};

import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import { serializeTask } from '../domain/serialize-task';
import { getTaskKey, getQueuedListKey } from '../utils';

export const putTask = async ({
  queue,
  task,
  client,
}: {
  queue: string;
  task: Task;
  client: RedisClient;
}): Promise<Task> => {
  const queuedTask: Task = {
    ...task,
    queuedOn: moment(),
    processingStartedOn: undefined,
    processingEndedOn: undefined,
    status: TaskStatuses.Queued,
    attemptCount: (task.attemptCount || 0) + 1,
  };
  const taskString = serializeTask(queuedTask);
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const queuedListKey = getQueuedListKey({ queue });
  return new Promise((resolve, reject) => {
    client.watch(taskKey, err => {
      if (err) reject(err);
      client
        .multi()
        .set(taskKey, taskString)
        .lpush(queuedListKey, task.id)
        .exec((multiErr, result) => {
          if (multiErr) reject(multiErr);
          if (result === null) reject(new Error('Multi command failed.'));
          resolve(queuedTask);
        });
    });
  });
};

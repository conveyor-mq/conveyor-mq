import { Redis } from 'ioredis';
import moment from 'moment';
import { map, forEach } from 'lodash';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import { serializeTask } from '../domain/serialize-task';
import { getTaskKey, getQueuedListKey } from '../utils/keys';

export const putTasks = async ({
  queue,
  tasks,
  client,
}: {
  queue: string;
  tasks: Task[];
  client: Redis;
}): Promise<Task[]> => {
  const tasksToQueue = map(tasks, (task) => ({
    ...task,
    queuedOn: moment(),
    processingStartedOn: undefined,
    processingEndedOn: undefined,
    status: TaskStatuses.Queued,
    maxAttemptCount: task.maxAttemptCount || 1,
    attemptCount: (task.attemptCount || 0) + 1,
    errorCount: task.errorCount || 0,
  }));
  const queuedListKey = getQueuedListKey({ queue });
  const multi = client.multi();
  forEach(tasksToQueue, (task) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const taskString = serializeTask(task);
    multi.set(taskKey, taskString);
    multi.lpush(queuedListKey, task.id);
  });
  return new Promise((resolve, reject) => {
    multi.exec((error, [resultError]) =>
      error || resultError === null
        ? reject(error || 'Multi command failed.')
        : resolve(tasksToQueue),
    );
  });
};

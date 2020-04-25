import { RedisClient } from 'redis';
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
  client: RedisClient;
}): Promise<Task[]> => {
  const tasksToQueue = map(tasks, (task) => ({
    ...task,
    queuedOn: moment(),
    processingStartedOn: undefined,
    processingEndedOn: undefined,
    status: TaskStatuses.Queued,
    attemptCount: (task.attemptCount || 0) + 1,
  }));
  const queuedListKey = getQueuedListKey({ queue });
  const taskKeys = map(tasksToQueue, (task) =>
    getTaskKey({ taskId: task.id, queue }),
  );
  return new Promise((resolve, reject) => {
    client.watch(...taskKeys, (err) => {
      if (err) reject(err);
      const multi = client.multi();
      forEach(tasksToQueue, (task) => {
        const taskKey = getTaskKey({ taskId: task.id, queue });
        const taskString = serializeTask(task);
        multi.set(taskKey, taskString);
        multi.lpush(queuedListKey, task.id);
        multi.exec((error, result) =>
          error || result === null
            ? reject(error || 'Multi command failed.')
            : resolve(tasksToQueue),
        );
      });
    });
  });
};

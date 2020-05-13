import { Redis } from 'ioredis';
import moment from 'moment';
import { map, forEach } from 'lodash';
import { serializeTask } from '../domain/tasks/serialize-task';
import {
  getTaskKey,
  getQueuedListKey,
  getProcessingListKey,
  getStallingHashKey,
} from '../utils/keys';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import { TaskStatuses } from '../domain/tasks/task-statuses';

/**
 * @ignore
 */
export const enqueueStalledTasks = async ({
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
    attemptCount: (task.attemptCount || 1) + 1,
  }));
  const queuedListKey = getQueuedListKey({ queue });
  const processingListKey = getProcessingListKey({ queue });
  const multi = client.multi();
  forEach(tasksToQueue, (task) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const taskString = serializeTask(task);
    multi.set(taskKey, taskString);
    multi.lrem(processingListKey, 1, task.id);
    multi.hdel(getStallingHashKey({ queue }), task.id);
    multi.lpush(queuedListKey, task.id);
  });
  await exec(multi);
  return tasksToQueue;
};

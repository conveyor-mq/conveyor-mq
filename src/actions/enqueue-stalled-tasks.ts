import { Redis } from 'ioredis';
import moment from 'moment';
import { map, forEach } from 'lodash';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import { serializeTask } from '../domain/serialize-task';
import {
  getTaskKey,
  getQueuedListKey,
  getProcessingListKey,
  getQueueTaskStalledChannel,
} from '../utils/keys';
import { exec } from '../utils/redis';

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
    multi.lpush(queuedListKey, task.id);
    multi.publish(getQueueTaskStalledChannel({ queue }), serializeTask(task));
  });
  await exec(multi);
  return tasksToQueue;
};

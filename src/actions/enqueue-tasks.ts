import { Redis } from 'ioredis';
import { map, forEach } from 'lodash';
import { serializeTask } from '../domain/tasks/serialize-task';
import {
  getTaskKey,
  getQueuedListKey,
  getQueueTaskQueuedChannel,
} from '../utils/keys';
import { exec } from '../utils/redis';
import { createTaskId } from '../utils/general';
import { Task } from '../domain/tasks/task';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';

/**
 * @ignore
 */
export const enqueueTasks = async ({
  tasks,
  queue,
  client,
}: {
  tasks: Partial<Task>[];
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const tasksToQueue: Task[] = map(tasks, (task) => ({
    ...task,
    id: task.id || createTaskId(),
    createdAt: new Date(),
    queuedAt: new Date(),
    processingStartedAt: undefined,
    processingEndedAt: undefined,
    status: TaskStatuses.Queued,
    retries: task.retries || 0,
    errorRetries: task.errorRetries || 0,
    errorRetryLimit:
      task.errorRetryLimit === undefined ? 0 : task.errorRetryLimit,
    stallRetries: task.stallRetries || 0,
    stallRetryLimit:
      task.stallRetryLimit === undefined ? 1 : task.stallRetryLimit,
  }));
  const queuedListKey = getQueuedListKey({ queue });
  const multi = client.multi();
  forEach(tasksToQueue, (task) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const taskString = serializeTask(task);
    multi.set(taskKey, taskString);
    multi.lpush(queuedListKey, task.id);
    multi.publish(
      getQueueTaskQueuedChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventTypes.TaskQueued,
        task,
      }),
    );
  });
  await exec(multi);
  return tasksToQueue;
};

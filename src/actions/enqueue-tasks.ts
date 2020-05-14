import { Redis } from 'ioredis';
import moment from 'moment';
import { map, forEach } from 'lodash';
import { serializeTask } from '../domain/tasks/serialize-task';
import {
  getTaskKey,
  getQueuedListKey,
  getQueueTaskQueuedChannel,
  getDelayedSetKey,
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
// TODO: Consider enqueueing task with enqueueAfter < now.
export const enqueueTasks = async ({
  queue,
  tasks,
  client,
}: {
  queue: string;
  tasks: Partial<Task>[];
  client: Redis;
}): Promise<Task[]> => {
  const tasksToQueue: Task[] = map(tasks, (task) => ({
    ...task,
    id: task.id || createTaskId(),
    queuedAt: moment(),
    processingStartedAt: undefined,
    processingEndedAt: undefined,
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
    if (task.enqueueAfter) {
      multi.zadd(
        getDelayedSetKey({ queue }),
        String(task.enqueueAfter.unix()),
        task.id,
      );
    } else {
      multi.lpush(queuedListKey, task.id);
      multi.publish(
        getQueueTaskQueuedChannel({ queue }),
        serializeEvent({
          createdAt: moment(),
          type: EventTypes.TaskQueued,
          task,
        }),
      );
    }
  });
  await exec(multi);
  return tasksToQueue;
};

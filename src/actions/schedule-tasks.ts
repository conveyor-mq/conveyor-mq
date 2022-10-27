import { Redis } from 'ioredis';
import { EventType } from '../domain/events/event-type';
import { serializeEvent } from '../domain/events/serialize-event';
import { Task } from '../domain/tasks/task';
import { TaskStatus } from '../domain/tasks/task-status';
import { dateToUnix } from '../utils/date';
import { createTaskId } from '../utils/general';
import {
  getQueueTaskScheduledChannel,
  getScheduledSetKey,
} from '../utils/keys';
import { exec } from '../utils/redis';
import { persistTaskMulti } from './persist-task';

/**
 * @ignore
 */
export const scheduleTasks = async ({
  tasks,
  queue,
  client,
}: {
  tasks: Partial<Task>[];
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const tasksToSchedule: Task[] = tasks.map((task) => {
    if (!task.enqueueAfter) {
      throw new Error('Scheduled task must specify enqueueAfter property.');
    }
    return {
      ...task,
      id: task.id || createTaskId(),
      createdAt: new Date(),
      processingStartedAt: undefined,
      processingEndedAt: undefined,
      status: TaskStatus.Scheduled,
      retries: task.retries || 0,
      errorRetries: task.errorRetries || 0,
      errorRetryLimit:
        task.errorRetryLimit === undefined ? 0 : task.errorRetryLimit,
      stallRetries: task.stallRetries || 0,
      stallRetryLimit:
        task.stallRetryLimit === undefined ? 1 : task.stallRetryLimit,
    };
  });
  const multi = client.multi();
  tasksToSchedule.forEach((task) => {
    persistTaskMulti({ task, queue, multi });
    multi.zadd(
      getScheduledSetKey({ queue }),
      String(dateToUnix(task.enqueueAfter)),
      task.id,
    );
    multi.publish(
      getQueueTaskScheduledChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventType.TaskScheduled,
        task,
      }),
    );
  });
  await exec(multi);
  return tasksToSchedule;
};

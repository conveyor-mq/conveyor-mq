import { Redis } from 'ioredis';
import moment from 'moment';
import { map, forEach } from 'lodash';
import { serializeTask } from '../domain/tasks/serialize-task';
import {
  getTaskKey,
  getScheduledSetKey,
  getQueueTaskScheduledChannel,
} from '../utils/keys';
import { exec } from '../utils/redis';
import { createTaskId } from '../utils/general';
import { Task } from '../domain/tasks/task';
import { TaskStatus } from '../domain/tasks/task-status';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';

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
  const tasksToSchedule: Task[] = map(tasks, (task) => {
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
  forEach(tasksToSchedule, (task) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const taskString = serializeTask(task);
    multi.set(taskKey, taskString);
    multi.zadd(
      getScheduledSetKey({ queue }),
      String(moment(task.enqueueAfter).unix()),
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

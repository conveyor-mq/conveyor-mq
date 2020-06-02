import { Redis, Pipeline } from 'ioredis';
import moment from 'moment';
import { Task } from '../domain/tasks/task';
import { persistTaskMulti } from './persist-task';
import {
  getScheduledSetKey,
  getQueueTaskScheduledChannel,
} from '../utils/keys';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';
import { createTaskId } from '../utils/general';
import { TaskStatus } from '../domain/tasks/task-status';
import { exec } from '../utils/redis';

export const scheduleTaskMulti = ({
  task,
  queue,
  multi,
}: {
  task: Partial<Task>;
  queue: string;
  multi: Pipeline;
}) => {
  if (!task.enqueueAfter) {
    throw new Error('Scheduled task must specify enqueueAfter property.');
  }
  const taskId = task.id || createTaskId();
  const taskToSchedule: Task = {
    ...task,
    id: taskId,
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
  persistTaskMulti({ taskId, taskData: taskToSchedule, queue, multi });
  multi.zadd(
    getScheduledSetKey({ queue }),
    String(moment(task.enqueueAfter).unix()),
    taskId,
  );
  multi.publish(
    getQueueTaskScheduledChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventType.TaskScheduled,
      task: taskToSchedule,
    }),
  );
  return taskToSchedule;
};

/**
 * @ignore
 */
export const scheduleTask = async ({
  task,
  queue,
  client,
}: {
  task: Partial<Task>;
  queue: string;
  client: Redis;
}): Promise<Task> => {
  const multi = client.multi();
  const scheduledTask = scheduleTaskMulti({ task, queue, multi });
  await exec(multi);
  return scheduledTask;
};

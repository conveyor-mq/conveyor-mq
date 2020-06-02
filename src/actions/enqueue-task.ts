import { Redis, Pipeline } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { exec, callLuaScriptMulti } from '../utils/redis';
import { createTaskId } from '../utils/general';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';
import {
  getQueuedListKey,
  getQueueTaskQueuedChannel,
  getQueuePausedKey,
  getPausedListKey,
} from '../utils/keys';
import { EventType } from '../domain/events/event-type';
import { persistTaskMulti } from './persist-task';
import { serializeEvent } from '../domain/events/serialize-event';

/**
 * @ignore
 */
export const enqueueTaskMulti = ({
  task,
  queue,
  multi,
}: {
  task: Partial<Task>;
  queue: string;
  multi: Pipeline;
}): Task => {
  const taskId = task.id || createTaskId();
  const taskToQueue: Task = {
    ...task,
    id: taskId,
    createdAt: task.createdAt || new Date(),
    queuedAt: new Date(),
    processingStartedAt: undefined,
    processingEndedAt: undefined,
    status: TaskStatus.Queued,
    retries: task.retries || 0,
    retryLimit: task.retryLimit,
    errorRetries: task.errorRetries || 0,
    errorRetryLimit:
      task.errorRetryLimit === undefined ? 0 : task.errorRetryLimit,
    stallRetries: task.stallRetries || 0,
    stallRetryLimit:
      task.stallRetryLimit === undefined ? 1 : task.stallRetryLimit,
  };
  persistTaskMulti({ taskId, taskData: taskToQueue, queue, multi });
  callLuaScriptMulti({
    multi,
    script: LuaScriptName.enqueueTask,
    args: [
      getQueuePausedKey({ queue }),
      getQueuedListKey({ queue }),
      getPausedListKey({ queue }),
      taskToQueue.id,
    ],
  });
  multi.publish(
    getQueueTaskQueuedChannel({ queue }),
    serializeEvent({
      type: EventType.TaskQueued,
      createdAt: new Date(),
      task: taskToQueue,
    }),
  );
  return taskToQueue;
};

/**
 * @ignore
 */
export const enqueueTask = async ({
  task,
  queue,
  client,
}: {
  task: Partial<Task>;
  queue: string;
  client: Redis;
}): Promise<Task> => {
  const multi = client.multi();
  const queuedTask = enqueueTaskMulti({ task, queue, multi });
  await exec(multi);
  return queuedTask;
};

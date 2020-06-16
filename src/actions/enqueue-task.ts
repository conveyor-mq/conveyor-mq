import { Redis, Pipeline } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { exec, callLuaScriptMulti } from '../utils/redis';
import { createTaskId } from '../utils/general';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';
import {
  getTaskKey,
  getQueuedListKey,
  getQueueTaskQueuedChannel,
  getQueuePausedKey,
  getPausedListKey,
} from '../utils/keys';
import { serializeTask } from '../domain/tasks/serialize-task';
import { EventType } from '../domain/events/event-type';

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
  const taskToQueue: Task = {
    ...task,
    id: task.id || createTaskId(),
    createdAt: task.createdAt || new Date(),
    queuedAt: new Date(),
    processingStartedAt: undefined,
    processingEndedAt: undefined,
    status: TaskStatus.Queued,
    retries: task.retries || 0,
    errorRetries: task.errorRetries || 0,
    errorRetryLimit:
      task.errorRetryLimit === undefined ? 0 : task.errorRetryLimit,
    stallRetries: task.stallRetries || 0,
    stallRetryLimit:
      task.stallRetryLimit === undefined ? 1 : task.stallRetryLimit,
  };
  const taskKey = getTaskKey({ taskId: taskToQueue.id, queue });
  const taskString = serializeTask(taskToQueue);
  callLuaScriptMulti({
    multi,
    script: LuaScriptName.enqueueTask,
    args: [
      taskKey,
      getQueuedListKey({ queue }),
      getQueuePausedKey({ queue }),
      getPausedListKey({ queue }),
      taskString,
      getQueueTaskQueuedChannel({ queue }),
      EventType.TaskQueued,
      new Date().toISOString(),
      taskToQueue.id,
    ],
  });
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

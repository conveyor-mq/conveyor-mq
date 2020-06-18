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

export type OnBeforeEnqueueTask = ({
  task,
  multi,
}: {
  task: Task;
  multi: Pipeline;
}) => any;

export type OnAfterEnqueueTask = ({ task }: { task: Task }) => any;

/**
 * @ignore
 */
export const enqueueTask = async ({
  task,
  queue,
  client,
  onBeforeEnqueueTask,
  onAfterEnqueueTask,
}: {
  task: Partial<Task>;
  queue: string;
  client: Redis;
  onBeforeEnqueueTask?: OnBeforeEnqueueTask;
  onAfterEnqueueTask?: OnAfterEnqueueTask;
}): Promise<Task> => {
  const multi = client.multi();
  const queuedTask = enqueueTaskMulti({ task, queue, multi });
  if (onBeforeEnqueueTask) {
    await onBeforeEnqueueTask({ task: queuedTask, multi });
  }
  await exec(multi);
  if (onAfterEnqueueTask) {
    await onAfterEnqueueTask({ task: queuedTask });
  }
  return queuedTask;
};

import {
  clearIntervalAsync,
  setIntervalAsync,
} from 'set-interval-async/dynamic';
import { Redis } from 'ioredis';
import { acknowledgeTask } from './acknowledge-task';
import {
  getRetryDelayType,
  TaskSuccessCb,
  TaskErrorCb,
  TaskFailedCb,
  Handler,
  handleTaskMulti,
  handleCallbacks,
} from './handle-task';
import { Task } from '../domain/tasks/task';
import { takeTaskAndMarkAsProcessingMulti } from './take-task-and-mark-as-processing';
import { exec } from '../utils/redis';
import { deSerializeTask } from '../domain/tasks/deserialize-task';

/**
 * @ignore
 */
export const processTask = async ({
  task,
  queue,
  client,
  handler,
  stallTimeout,
  taskAcknowledgementInterval,
  onAcknowledgeTask,
  onAcknowledgedTask,
  getRetryDelay,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
  removeOnSuccess,
  removeOnFailed,
}: {
  task: Task;
  queue: string;
  client: Redis;
  handler: Handler;
  stallTimeout: number;
  taskAcknowledgementInterval: number;
  onAcknowledgeTask?: ({ task }: { task: Task }) => any;
  onAcknowledgedTask?: ({ task }: { task: Task }) => any;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: TaskSuccessCb;
  onTaskError?: TaskErrorCb;
  onTaskFailed?: TaskFailedCb;
  removeOnSuccess?: boolean;
  removeOnFailed?: boolean;
}): Promise<Task | null> => {
  const timer = setIntervalAsync(async () => {
    if (onAcknowledgeTask) onAcknowledgeTask({ task });
    await acknowledgeTask({
      taskId: task.id,
      queue,
      client,
      ttl: stallTimeout,
    });
    if (onAcknowledgedTask) onAcknowledgedTask({ task });
  }, taskAcknowledgementInterval);
  const multi = client.multi();
  const response = await handleTaskMulti({
    task,
    queue,
    handler,
    client,
    multi,
    asOf: new Date(),
    getRetryDelay,
    removeOnSuccess,
    removeOnFailed,
  });
  await clearIntervalAsync(timer);
  await handleCallbacks({ response, onTaskSuccess, onTaskError, onTaskFailed });
  takeTaskAndMarkAsProcessingMulti({ queue, multi, stallTimeout });
  const result = await exec(multi);
  const taskString = result[result.length - 1] as string | null;
  return taskString ? deSerializeTask(taskString) : null;
};

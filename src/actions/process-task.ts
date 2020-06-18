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

export type OnAfterTaskSuccess = ({ task }: { task: Task }) => any;
export type OnAfterTaskError = ({ task }: { task: Task }) => any;
export type OnAfterTaskFail = ({ task }: { task: Task }) => any;

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
  hooks,
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
  hooks?: {
    onAfterTaskSuccess?: OnAfterTaskSuccess;
    onAfterTaskError?: OnAfterTaskError;
    onAfterTaskFail?: OnAfterTaskFail;
  };
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
  const multi = client.pipeline();
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
  takeTaskAndMarkAsProcessingMulti({ queue, multi, stallTimeout });
  const [result] = await Promise.all([
    exec(multi),
    clearIntervalAsync(timer),
    handleCallbacks({ response, onTaskSuccess, onTaskError, onTaskFailed }),
  ]);
  const hookMap = {
    taskSuccess: () =>
      hooks?.onAfterTaskSuccess &&
      hooks.onAfterTaskSuccess({ task: response.params.task }),
    taskError: () =>
      hooks?.onAfterTaskError &&
      hooks.onAfterTaskError({ task: response.params.task }),
    taskFailed: async () => {
      if (hooks?.onAfterTaskError) {
        await hooks.onAfterTaskError({ task: response.params.task });
      }
      if (hooks?.onAfterTaskFail) {
        await hooks.onAfterTaskFail({ task: response.params.task });
      }
    },
  };
  const hook = hookMap[response.name];
  await hook();
  const taskString = result[result.length - 1] as string | null;
  const nextTaskToHandle = taskString ? deSerializeTask(taskString) : null;
  return nextTaskToHandle;
};

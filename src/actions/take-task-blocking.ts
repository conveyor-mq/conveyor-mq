import { Redis } from 'ioredis';
import moment from 'moment';
import { Task } from '../domain/task';
import { getTask } from './get-task';
import { TaskStatuses } from '../domain/task-statuses';
import { updateTask } from './update-task';
import { acknowledgeTask } from './acknowledge-task';
import { brpoplpush, callLuaScript } from '../utils/redis';
import {
  getQueuedListKey,
  getProcessingListKey,
  getTaskKey,
  getQueueTaskProcessingChannel,
  getStallingHashKey,
} from '../utils/keys';
import { deSerializeTask } from '../domain/deserialize-task';

export const takeTaskBlocking = async ({
  timeout = 0,
  queue,
  client,
  stallDuration = 1000,
}: {
  timeout?: number;
  queue: string;
  client: Redis;
  stallDuration?: number;
}): Promise<Task | null> => {
  const taskId = await brpoplpush({
    fromKey: getQueuedListKey({ queue }),
    toKey: getProcessingListKey({ queue }),
    timeout,
    client,
  });
  if (!taskId) return null;
  const taskString = await callLuaScript({
    client,
    script: 'markTaskProcessing',
    args: [
      taskId,
      getTaskKey({ taskId: '', queue }),
      stallDuration,
      queue,
      moment().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      getStallingHashKey({ queue }),
    ],
  });
  const task = deSerializeTask(taskString);
  return task;
};

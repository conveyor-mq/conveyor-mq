import { Redis } from 'ioredis';
import { Task } from '../domain/task';
import { brpoplpush } from '../utils/redis';
import { getQueuedListKey, getProcessingListKey } from '../utils/keys';
import { markTaskProcessing } from './mark-task-processing';

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
  const task = await markTaskProcessing({
    taskId,
    stallDuration,
    queue,
    client,
  });
  return task;
};

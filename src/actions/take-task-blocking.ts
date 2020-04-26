import { Redis } from 'ioredis';
import moment from 'moment';
import { Task } from '../domain/task';
import { getTask } from './get-task';
import { TaskStatuses } from '../domain/task-statuses';
import { updateTask } from './update-task';
import { acknowledgeTask } from './acknowledge-task';
import { brpoplpush } from '../utils/redis';
import { getQueuedListKey, getProcessingListKey } from '../utils/keys';

// TODO: rpop, get and set in a multi.
// TODO: Dedup with takeTask.
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
  const acknowledgePromise = acknowledgeTask({
    taskId,
    queue,
    client,
    ttl: stallDuration,
  });
  const task = await getTask({ queue, taskId, client });
  if (task === null) return null;
  const processingTask: Task = {
    ...task,
    processingStartedOn: moment(),
    status: TaskStatuses.Processing,
  };
  const [updatedTask] = await Promise.all([
    updateTask({ task: processingTask, queue, client }),
    acknowledgePromise,
  ]);
  return updatedTask;
};

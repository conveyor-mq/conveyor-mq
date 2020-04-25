import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { brpop, getQueuedListKey } from '../utils';
import { getTask } from './get-task';
import { TaskStatuses } from '../domain/task-statuses';
import { updateTask } from './update-task';
import { acknowledgeTask } from './acknowledge-task';

// TODO: rpop, get and set in a multi.
// TODO: Dedup with takeTask.
// TODO: Use brpoplpush.
export const takeTaskBlocking = async ({
  timeout = 0,
  queue,
  client,
  stallDuration = 1000,
}: {
  timeout?: number;
  queue: string;
  client: RedisClient;
  stallDuration?: number;
}): Promise<Task | null> => {
  const response = await brpop({
    key: getQueuedListKey({ queue }),
    timeout,
    client,
  });
  if (!response || !response[1]) return null;
  const taskId = response[1];
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

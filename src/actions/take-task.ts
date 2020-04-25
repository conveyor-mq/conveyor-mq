import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { rpop, getQueuedListKey, getTaskKey, set } from '../utils';
import { getTask } from './get-task';
import { TaskStatuses } from '../domain/task-statuses';
import { serializeTask } from '../domain/serialize-task';
import { updateTask } from './update-task';

// TODO: rpop, get and set in a multi.
export const takeTask = async ({
  queue,
  client,
}: {
  queue: string;
  client: RedisClient;
}): Promise<Task | null> => {
  const taskId = await rpop({
    key: getQueuedListKey({ queue }),
    client,
  });
  if (taskId === null) return null;
  const task = await getTask({ queue, taskId, client });
  if (task === null) return null;
  const processingTask: Task = {
    ...task,
    processingStartedOn: moment(),
    status: TaskStatuses.Processing,
  };
  await updateTask({ task: processingTask, queue, client });
  return processingTask;
};

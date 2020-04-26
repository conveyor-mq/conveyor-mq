import { Redis } from 'ioredis';
import moment from 'moment';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import { updateTask } from './update-task';
import { callLuaScript } from '../utils/redis';
import {
  getQueuedListKey,
  getProcessingListKey,
  getTaskKey,
} from '../utils/keys';
import { deSerializeTask } from '../domain/deserialize-task';

// TODO: Dedup with takeTaskBlocking.
export const takeTask = async ({
  queue,
  client,
  stallDuration = 1000,
}: {
  queue: string;
  client: Redis;
  stallDuration?: number;
}): Promise<Task | null> => {
  const taskString = await callLuaScript({
    client,
    script: 'takeTask',
    args: [
      getQueuedListKey({ queue }),
      getProcessingListKey({ queue }),
      getTaskKey({ taskId: '', queue }),
      stallDuration,
      queue,
    ],
  });
  if (!taskString) return null;
  const task = deSerializeTask(taskString);
  const processingTask: Task = {
    ...task,
    processingStartedOn: moment(),
    status: TaskStatuses.Processing,
  };
  const updatedTask = await updateTask({ task: processingTask, queue, client });
  return updatedTask;
};

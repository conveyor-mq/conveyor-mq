import { Redis } from 'ioredis';
import moment from 'moment';
import { callLuaScript } from '../utils/redis';
import {
  getQueuedListKey,
  getProcessingListKey,
  getTaskKey,
  getQueueTaskProcessingChannel,
  getStallingHashKey,
} from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { Task } from '../domain/tasks/task';
import { EventTypes } from '../domain/events/event-types';
import { TaskStatuses } from '../domain/tasks/task-statuses';

/**
 * @ignore
 */
export const takeTask = async ({
  queue,
  client,
  stallTimeout = 1000,
}: {
  queue: string;
  client: Redis;
  stallTimeout?: number;
}): Promise<Task | null> => {
  const taskString = (await callLuaScript({
    client,
    script: 'takeTask',
    args: [
      getQueuedListKey({ queue }),
      getProcessingListKey({ queue }),
      getTaskKey({ taskId: '', queue }),
      stallTimeout,
      queue,
      moment().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      getStallingHashKey({ queue }),
      EventTypes.TaskProcessing,
      TaskStatuses.Processing,
    ],
  })) as string;
  if (!taskString) return null;
  const task = deSerializeTask(taskString);
  return task;
};

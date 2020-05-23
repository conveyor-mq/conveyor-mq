import { Redis } from 'ioredis';
import moment from 'moment';
import { callLuaScript } from '../utils/redis';
import {
  getQueuedListKey,
  getProcessingListKey,
  getQueueTaskProcessingChannel,
  getStallingHashKey,
  getTaskKeyPrefix,
} from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { Task } from '../domain/tasks/task';
import { EventTypes } from '../domain/events/event-types';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { ScriptNames } from '../lua';

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
    script: ScriptNames.takeTask,
    args: [
      getQueuedListKey({ queue }),
      getProcessingListKey({ queue }),
      getTaskKeyPrefix({ queue }),
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

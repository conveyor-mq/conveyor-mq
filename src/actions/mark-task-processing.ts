import { Redis } from 'ioredis';
import moment from 'moment';
import { callLuaScript } from '../utils/redis';
import {
  getQueueTaskProcessingChannel,
  getStallingHashKey,
  getTaskKeyPrefix,
} from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { EventType } from '../domain/events/event-type';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';

/**
 * @ignore
 */
export const markTaskProcessing = async ({
  taskId,
  stallTimeout,
  queue,
  client,
}: {
  taskId: string;
  stallTimeout: number;
  queue: string;
  client: Redis;
}) => {
  const taskString = (await callLuaScript({
    client,
    script: LuaScriptName.markTaskProcessing,
    args: [
      taskId,
      getTaskKeyPrefix({ queue }),
      stallTimeout,
      queue,
      moment().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      getStallingHashKey({ queue }),
      EventType.TaskProcessing,
      TaskStatus.Processing,
    ],
  })) as string;
  const task = deSerializeTask(taskString);
  return task;
};

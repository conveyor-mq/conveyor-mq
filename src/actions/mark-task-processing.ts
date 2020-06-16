import { Redis } from 'ioredis';
import { callLuaScript } from '../utils/redis';
import {
  getQueueTaskProcessingChannel,
  getStallingHashKey,
  getTaskKey,
  getTaskAcknowledgedKey,
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
      getTaskKey({ taskId, queue }),
      getStallingHashKey({ queue }),
      getTaskAcknowledgedKey({ taskId, queue }),
      stallTimeout,
      new Date().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      EventType.TaskProcessing,
      TaskStatus.Processing,
      taskId,
    ],
  })) as string;
  const task = deSerializeTask(taskString);
  return task;
};

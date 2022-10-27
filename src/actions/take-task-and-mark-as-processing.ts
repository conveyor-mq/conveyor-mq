import { ChainableCommander, Redis } from 'ioredis';
import { EventType } from '../domain/events/event-type';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { Task } from '../domain/tasks/task';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';
import {
  getProcessingListKey,
  getQueuedListKey,
  getQueueTaskProcessingChannel,
  getStallingHashKey,
  getTaskKeyPrefix,
} from '../utils/keys';
import { callLuaScriptMulti, exec } from '../utils/redis';

/**
 * @ignore
 */
export const takeTaskAndMarkAsProcessingMulti = ({
  queue,
  multi,
  stallTimeout = 1000,
}: {
  queue: string;
  multi: ChainableCommander;
  stallTimeout?: number;
}): void => {
  callLuaScriptMulti({
    multi,
    script: LuaScriptName.takeTaskAndMarkAsProcessing,
    args: [
      getQueuedListKey({ queue }),
      getProcessingListKey({ queue }),
      getStallingHashKey({ queue }),
      getTaskKeyPrefix({ queue }),
      stallTimeout,
      queue,
      new Date().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      EventType.TaskProcessing,
      TaskStatus.Processing,
    ],
  });
};

/**
 * @ignore
 */
export const takeTaskAndMarkAsProcessing = async ({
  queue,
  client,
  stallTimeout = 1000,
}: {
  queue: string;
  client: Redis;
  stallTimeout?: number;
}): Promise<Task | null> => {
  const multi = client.multi();
  takeTaskAndMarkAsProcessingMulti({ queue, multi, stallTimeout });
  const result = await exec(multi);
  const taskString = result[result.length - 1] as string | null;
  if (!taskString) return null;
  const task = deSerializeTask(taskString);
  return task;
};

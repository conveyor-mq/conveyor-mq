import { Redis, Pipeline } from 'ioredis';
import moment from 'moment';
import { exec, callLuaScriptMulti } from '../utils/redis';
import {
  getQueuedListKey,
  getProcessingListKey,
  getQueueTaskProcessingChannel,
  getStallingHashKey,
  getTaskKeyPrefix,
} from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { Task } from '../domain/tasks/task';
import { EventType } from '../domain/events/event-type';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';

/**
 * @ignore
 */
export const takeTaskAndMarkAsProcessingMulti = ({
  queue,
  multi,
  stallTimeout = 1000,
}: {
  queue: string;
  multi: Pipeline;
  stallTimeout?: number;
}): void => {
  callLuaScriptMulti({
    multi,
    script: LuaScriptName.takeTask,
    args: [
      getQueuedListKey({ queue }),
      getProcessingListKey({ queue }),
      getTaskKeyPrefix({ queue }),
      stallTimeout,
      queue,
      moment().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      getStallingHashKey({ queue }),
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

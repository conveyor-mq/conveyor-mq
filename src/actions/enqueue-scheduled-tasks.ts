import { Redis } from 'ioredis';
import { EventType } from '../domain/events/event-type';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';
import {
  getPausedListKey,
  getQueuedListKey,
  getQueuePausedKey,
  getQueueTaskQueuedChannel,
  getScheduledSetKey,
  getTaskKeyPrefix,
} from '../utils/keys';
import { callLuaScript } from '../utils/redis';

/**
 * @ignore
 */
export const enqueueScheduledTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const now = new Date();
  const taskStrings = (await callLuaScript({
    client,
    script: LuaScriptName.enqueueScheduledTasks,
    args: [
      getScheduledSetKey({ queue }),
      getQueuedListKey({ queue }),
      getQueuePausedKey({ queue }),
      getPausedListKey({ queue }),
      now.getTime() / 1000,
      getTaskKeyPrefix({ queue }),
      TaskStatus.Queued,
      now.toISOString(),
      EventType.TaskQueued,
      getQueueTaskQueuedChannel({ queue }),
    ],
  })) as string[];
  const tasks = taskStrings.map((taskString) => deSerializeTask(taskString));
  return tasks;
};

import { Redis } from 'ioredis';
import { map } from 'lodash';
import { callLuaScript } from '../utils/redis';
import {
  getScheduledSetKey,
  getQueuedListKey,
  getTaskKeyPrefix,
  getQueueTaskQueuedChannel,
  getQueuePausedKey,
  getPausedListKey,
} from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { TaskStatus } from '../domain/tasks/task-status';
import { LuaScriptName } from '../lua';
import { EventType } from '../domain/events/event-type';

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
  const tasks = map(taskStrings, (taskString) => deSerializeTask(taskString));
  return tasks;
};

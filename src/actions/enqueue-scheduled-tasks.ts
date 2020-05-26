import { Redis } from 'ioredis';
import moment from 'moment';
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
import { ScriptNames } from '../lua';
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
  const now = moment();
  const taskStrings = (await callLuaScript({
    client,
    script: ScriptNames.enqueueDelayedTasks,
    args: [
      getScheduledSetKey({ queue }),
      getQueuedListKey({ queue }),
      now.unix(),
      getTaskKeyPrefix({ queue }),
      TaskStatus.Queued,
      now.toISOString(),
      EventType.TaskQueued,
      getQueueTaskQueuedChannel({ queue }),
      getQueuePausedKey({ queue }),
      getPausedListKey({ queue }),
    ],
  })) as string[];
  const tasks = map(taskStrings, (taskString) => deSerializeTask(taskString));
  return tasks;
};

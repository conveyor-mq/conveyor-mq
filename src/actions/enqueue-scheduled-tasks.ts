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
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { ScriptNames } from '../lua';
import { EventTypes } from '../domain/events/event-types';

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
      TaskStatuses.Queued,
      now.toISOString(),
      EventTypes.TaskQueued,
      getQueueTaskQueuedChannel({ queue }),
      getQueuePausedKey({ queue }),
      getPausedListKey({ queue }),
    ],
  })) as string[];
  const tasks = map(taskStrings, (taskString) => deSerializeTask(taskString));
  return tasks;
};

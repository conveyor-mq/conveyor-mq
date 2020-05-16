import { Redis } from 'ioredis';
import moment from 'moment';
import { map } from 'lodash';
import { callLuaScript } from '../utils/redis';
import { getDelayedSetKey, getQueuedListKey, getTaskKey } from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { TaskStatuses } from '../domain/tasks/task-statuses';

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
    script: 'enqueueDelayedTasks',
    args: [
      getDelayedSetKey({ queue }),
      getQueuedListKey({ queue }),
      now.unix(),
      getTaskKey({ taskId: '', queue }),
      TaskStatuses.Queued,
    ],
  })) as string[];
  const tasks = map(taskStrings, (taskString) => deSerializeTask(taskString));
  return tasks;
};

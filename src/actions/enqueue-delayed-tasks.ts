import { Redis } from 'ioredis';
import moment from 'moment';
import { map } from 'lodash';
import { callLuaScript } from '../utils/redis';
import { getDelayedSetKey, getQueuedListKey, getTaskKey } from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';

/**
 * @ignore
 */
export const enqueueDelayedTasks = async ({
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
    ],
  })) as string[];
  const tasks = map(taskStrings, (taskString) => deSerializeTask(taskString));
  return tasks;
};

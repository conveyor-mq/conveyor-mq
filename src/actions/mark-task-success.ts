import { Redis } from 'ioredis';
import {
  getTaskKey,
  getProcessingListKey,
  getStallingHashKey,
  getSuccessListKey,
  getQueueTaskSuccessChannel,
  getQueueTaskCompleteChannel,
} from '../utils/keys';
import { callLuaScript } from '../utils/redis';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { EventTypes } from '../domain/events/event-types';
import { ScriptNames } from '../lua';
import { deSerializeTask } from '../domain/tasks/deserialize-task';

/**
 * @ignore
 */
export const markTaskSuccess = async ({
  taskId,
  queue,
  client,
  result,
  asOf,
  remove,
}: {
  taskId: string;
  queue: string;
  client: Redis;
  result?: any;
  asOf: Date;
  remove?: boolean;
}) => {
  const taskString = (await callLuaScript({
    client,
    script: ScriptNames.markTaskSuccess,
    args: [
      taskId,
      TaskStatuses.Success,
      JSON.stringify(result),
      getTaskKey({ taskId, queue }),
      asOf.toISOString(),
      String(!!remove),
      getSuccessListKey({ queue }),
      getProcessingListKey({ queue }),
      getStallingHashKey({ queue }),
      EventTypes.TaskSuccess,
      EventTypes.TaskComplete,
      getQueueTaskSuccessChannel({ queue }),
      getQueueTaskCompleteChannel({ queue }),
    ],
  })) as string;
  const successfulTask = deSerializeTask(taskString);
  return successfulTask;
};

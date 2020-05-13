import { Redis } from 'ioredis';
import moment from 'moment';
import { callLuaScript } from '../utils/redis';
import {
  getTaskKey,
  getQueueTaskProcessingChannel,
  getStallingHashKey,
} from '../utils/keys';
import { deSerializeTask } from '../domain/tasks/deserialize-task';
import { EventTypes } from '../domain/events/event-types';
import { TaskStatuses } from '../domain/tasks/task-statuses';

/**
 * @ignore
 */
export const markTaskProcessing = async ({
  taskId,
  stallDuration,
  queue,
  client,
}: {
  taskId: string;
  stallDuration: number;
  queue: string;
  client: Redis;
}) => {
  const taskString = await callLuaScript({
    client,
    script: 'markTaskProcessing',
    args: [
      taskId,
      getTaskKey({ taskId: '', queue }),
      stallDuration,
      queue,
      moment().toISOString(),
      getQueueTaskProcessingChannel({ queue }),
      getStallingHashKey({ queue }),
      EventTypes.TaskProcessing,
      TaskStatuses.Processing,
    ],
  });
  const task = deSerializeTask(taskString);
  return task;
};

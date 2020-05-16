import { Redis } from 'ioredis';
import {
  getTaskKey,
  getProcessingListKey,
  getQueueTaskSuccessChannel,
  getQueueTaskCompleteChannel,
  getStallingHashKey,
} from '../utils/keys';
import { serializeTask } from '../domain/tasks/serialize-task';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';

/**
 * @ignore
 */
export const markTaskSuccess = async ({
  task,
  queue,
  client,
  result,
  asOf,
}: {
  task: Task;
  queue: string;
  client: Redis;
  result?: any;
  asOf: Date;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const processingListKey = getProcessingListKey({ queue });
  const successfulTask: Task = {
    ...task,
    processingEndedAt: asOf,
    status: TaskStatuses.Success,
    result,
  };
  const multi = client.multi();
  multi.set(taskKey, serializeTask(successfulTask));
  multi.lrem(processingListKey, 1, task.id);
  multi.hdel(getStallingHashKey({ queue }), task.id);
  multi.publish(
    getQueueTaskSuccessChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventTypes.TaskSuccess,
      task: successfulTask,
    }),
  );
  multi.publish(
    getQueueTaskCompleteChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventTypes.TaskComplete,
      task: successfulTask,
    }),
  );
  await exec(multi);
  return successfulTask;
};

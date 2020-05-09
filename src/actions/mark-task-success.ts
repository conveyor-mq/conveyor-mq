import { Redis } from 'ioredis';
import moment, { Moment } from 'moment';
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
  asOf: Moment;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const processingListKey = getProcessingListKey({ queue });
  const successfulTask: Task = {
    ...task,
    processingEndedOn: asOf,
    status: TaskStatuses.Success,
    result,
  };
  const multi = client.multi();
  multi.set(taskKey, serializeTask(successfulTask));
  multi.lrem(processingListKey, 1, task.id);
  multi.hdel(getStallingHashKey({ queue }), task.id);
  multi.publish(
    getQueueTaskSuccessChannel({ queue }),
    serializeEvent({ createdAt: moment(), type: EventTypes.TaskSuccess, task }),
  );
  multi.publish(
    getQueueTaskCompleteChannel({ queue }),
    serializeEvent({
      createdAt: moment(),
      type: EventTypes.TaskComplete,
      task,
    }),
  );
  await exec(multi);
  return successfulTask;
};

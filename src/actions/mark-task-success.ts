import { Redis } from 'ioredis';
import { Moment } from 'moment';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import {
  getTaskKey,
  getProcessingListKey,
  getQueueTaskSuccessChannel,
  getQueueTaskCompleteChannel,
  getStallingHashKey,
} from '../utils/keys';
import { serializeTask } from '../domain/serialize-task';
import { exec } from '../utils/redis';

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
    serializeTask(successfulTask),
  );
  multi.publish(
    getQueueTaskCompleteChannel({ queue }),
    serializeTask(successfulTask),
  );
  await exec(multi);
  return successfulTask;
};

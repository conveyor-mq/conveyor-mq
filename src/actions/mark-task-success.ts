import { Redis, Pipeline } from 'ioredis';
import {
  getTaskKey,
  getProcessingListKey,
  getQueueTaskSuccessChannel,
  getStallingHashKey,
  getSuccessListKey,
} from '../utils/keys';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import { TaskStatus } from '../domain/tasks/task-status';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';
import { persistTaskMulti } from './persist-task';

/**
 * @ignore
 */
export const markTaskSuccessMulti = ({
  task,
  queue,
  multi,
  result,
  asOf,
  remove,
}: {
  task: Task;
  queue: string;
  multi: Pipeline;
  result?: any;
  asOf: Date;
  remove?: boolean;
}): Task => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const processingListKey = getProcessingListKey({ queue });
  const successfulTask: Task = {
    ...task,
    processingEndedAt: asOf,
    status: TaskStatus.Success,
    result,
  };
  if (remove) {
    multi.del(taskKey);
  } else {
    persistTaskMulti({ task: successfulTask, queue, multi });
    multi.lpush(getSuccessListKey({ queue }), task.id);
  }
  multi.lrem(processingListKey, 1, task.id);
  multi.hdel(getStallingHashKey({ queue }), task.id);
  multi.publish(
    getQueueTaskSuccessChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventType.TaskSuccess,
      task: successfulTask,
    }),
  );
  return successfulTask;
};

/**
 * @ignore
 */
export const markTaskSuccess = async ({
  task,
  queue,
  client,
  result,
  asOf,
  remove,
}: {
  task: Task;
  queue: string;
  client: Redis;
  result?: any;
  asOf: Date;
  remove?: boolean;
}): Promise<Task> => {
  const multi = client.multi();
  const successfulTask = await markTaskSuccessMulti({
    task,
    queue,
    multi,
    result,
    asOf,
    remove,
  });
  await exec(multi);
  return successfulTask;
};

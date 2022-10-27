import { ChainableCommander, Redis } from 'ioredis';
import { EventType } from '../domain/events/event-type';
import { serializeEvent } from '../domain/events/serialize-event';
import { Task } from '../domain/tasks/task';
import { TaskStatus } from '../domain/tasks/task-status';
import {
  getFailedListKey,
  getProcessingListKey,
  getQueueTaskCompleteChannel,
  getQueueTaskFailedChannel,
  getStallingHashKey,
  getTaskKey,
} from '../utils/keys';
import { exec } from '../utils/redis';
import { persistTaskMulti } from './persist-task';

/**
 * @ignore
 */
export const markTaskFailedMulti = ({
  task,
  queue,
  multi,
  error,
  remove,
}: {
  task: Task;
  queue: string;
  multi: ChainableCommander;
  error?: any;
  remove?: boolean;
}): Task => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const failedTask: Task = {
    ...task,
    processingEndedAt: new Date(),
    status: TaskStatus.Failed,
    error,
  };
  if (remove) {
    multi.del(taskKey);
  } else {
    persistTaskMulti({ task: failedTask, queue, multi });
    multi.lpush(getFailedListKey({ queue }), task.id);
  }
  multi.lrem(getProcessingListKey({ queue }), 1, task.id);
  multi.hdel(getStallingHashKey({ queue }), task.id);
  multi.publish(
    getQueueTaskFailedChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventType.TaskFail,
      task: failedTask,
    }),
  );
  multi.publish(
    getQueueTaskCompleteChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventType.TaskComplete,
      task: failedTask,
    }),
  );
  return failedTask;
};

/**
 * @ignore
 */
export const markTaskFailed = async ({
  task,
  queue,
  client,
  error,
  remove,
}: {
  task: Task;
  queue: string;
  client: Redis;
  error?: any;
  remove?: boolean;
}): Promise<Task> => {
  const multi = client.multi();
  const failedTask = markTaskFailedMulti({ task, queue, multi, error, remove });
  await exec(multi);
  return failedTask;
};

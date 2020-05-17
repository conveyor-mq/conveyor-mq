import { Redis } from 'ioredis';
import { map } from 'lodash';
import {
  getTaskKey,
  getProcessingListKey,
  getQueueTaskCompleteChannel,
  getQueueTaskFailedChannel,
  getStallingHashKey,
  getFailedListKey,
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
export const markTasksFailed = async ({
  tasksAndErrors,
  queue,
  client,
  asOf,
  remove,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  client: Redis;
  asOf: Date;
  remove?: boolean;
}): Promise<Task[]> => {
  const processingListKey = getProcessingListKey({ queue });
  const multi = client.multi();
  const failedTasks = map(tasksAndErrors, ({ task, error }) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const failedTask: Task = {
      ...task,
      processingEndedAt: asOf,
      status: TaskStatuses.Failed,
      error,
    };
    if (remove) {
      multi.del(taskKey);
    } else {
      multi.set(taskKey, serializeTask(failedTask));
      multi.lpush(getFailedListKey({ queue }), task.id);
    }
    multi.lrem(processingListKey, 1, task.id);
    multi.hdel(getStallingHashKey({ queue }), task.id);
    multi.publish(
      getQueueTaskFailedChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventTypes.TaskFail,
        task: failedTask,
      }),
    );
    multi.publish(
      getQueueTaskCompleteChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventTypes.TaskComplete,
        task: failedTask,
      }),
    );
    return failedTask;
  });
  await exec(multi);
  return failedTasks;
};

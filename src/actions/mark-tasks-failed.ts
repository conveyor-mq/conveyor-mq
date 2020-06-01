import { Redis, Pipeline } from 'ioredis';
import map from 'lodash/map';
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
import { TaskStatus } from '../domain/tasks/task-status';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';

/**
 * @ignore
 */
export const markTasksFailedMulti = ({
  tasksAndErrors,
  queue,
  multi,
  remove,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  multi: Pipeline;
  remove?: boolean;
}) => {
  const processingListKey = getProcessingListKey({ queue });
  const failedTasks = map(tasksAndErrors, ({ task, error }) => {
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
      multi.set(taskKey, serializeTask(failedTask));
      multi.lpush(getFailedListKey({ queue }), task.id);
    }
    multi.lrem(processingListKey, 1, task.id);
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
  });
  return failedTasks;
};

/**
 * @ignore
 */
export const markTasksFailed = async ({
  tasksAndErrors,
  queue,
  client,
  remove,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  client: Redis;
  remove?: boolean;
}): Promise<Task[]> => {
  const multi = client.multi();
  const failedTasks = await markTasksFailedMulti({
    tasksAndErrors,
    queue,
    multi,
    remove,
  });
  await exec(multi);
  return failedTasks;
};

import { Redis } from 'ioredis';
import { Moment } from 'moment';
import { map } from 'lodash';
import { Task } from '../domain/task';
import { TaskStatuses } from '../domain/task-statuses';
import {
  getTaskKey,
  getProcessingListKey,
  getQueueTaskCompleteChannel,
  getQueueTaskFailedChannel,
  getStallingHashKey,
} from '../utils/keys';
import { serializeTask } from '../domain/serialize-task';
import { exec } from '../utils/redis';

export const markTasksFailed = async ({
  tasksAndErrors,
  queue,
  client,
  asOf,
}: {
  tasksAndErrors: { task: Task; error: any }[];
  queue: string;
  client: Redis;
  asOf: Moment;
}): Promise<Task[]> => {
  const processingListKey = getProcessingListKey({ queue });
  const multi = client.multi();
  const failedTasks = map(tasksAndErrors, ({ task, error }) => {
    const taskKey = getTaskKey({ taskId: task.id, queue });
    const failedTask: Task = {
      ...task,
      processingEndedOn: asOf,
      status: TaskStatuses.Failed,
      error,
    };
    multi.set(taskKey, serializeTask(failedTask));
    multi.lrem(processingListKey, 1, task.id);
    multi.hdel(getStallingHashKey({ queue }), task.id);
    multi.publish(
      getQueueTaskFailedChannel({ queue }),
      serializeTask(failedTask),
    );
    multi.publish(
      getQueueTaskCompleteChannel({ queue }),
      serializeTask(failedTask),
    );
    return failedTask;
  });
  await exec(multi);
  return failedTasks;
};

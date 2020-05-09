import { Redis } from 'ioredis';
import moment, { Moment } from 'moment';
import { map } from 'lodash';
import {
  getTaskKey,
  getProcessingListKey,
  getQueueTaskCompleteChannel,
  getQueueTaskFailedChannel,
  getStallingHashKey,
} from '../utils/keys';
import { serializeTask } from '../domain/tasks/serialize-task';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import { TaskStatuses } from '../domain/tasks/task-statuses';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';

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
      serializeEvent({
        createdAt: moment(),
        type: EventTypes.TaskFail,
        task: failedTask,
      }),
    );
    multi.publish(
      getQueueTaskCompleteChannel({ queue }),
      serializeEvent({
        createdAt: moment(),
        type: EventTypes.TaskComplete,
        task: failedTask,
      }),
    );
    return failedTask;
  });
  await exec(multi);
  return failedTasks;
};

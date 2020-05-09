import { Redis } from 'ioredis';
import moment from 'moment';
import { serializeTask } from '../domain/tasks/serialize-task';
import { exec } from '../utils/redis';
import { getTaskKey, getQueueTaskUpdatedChannel } from '../utils/keys';
import { Task } from '../domain/tasks/task';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';

export const updateTask = async ({
  task,
  queue,
  client,
}: {
  task: Task;
  queue: string;
  client: Redis;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const multi = client.multi();
  multi.set(taskKey, serializeTask(task));
  multi.publish(
    getQueueTaskUpdatedChannel({ queue }),
    serializeEvent({ createdAt: moment(), type: EventTypes.TaskUpdated, task }),
  );
  await exec(multi);
  return task;
};

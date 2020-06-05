import { Redis } from 'ioredis';
import { exec } from '../utils/redis';
import { getQueueTaskProgressUpdatedChannel } from '../utils/keys';
import { Task } from '../domain/tasks/task';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';
import { persistTaskMulti } from './persist-task';

/**
 * @ignore
 */
export const updateTaskProgress = async ({
  task,
  progress,
  queue,
  client,
}: {
  task: Task;
  progress: any;
  queue: string;
  client: Redis;
}) => {
  const updatedTask = { ...task, progress };
  const multi = client.multi();
  persistTaskMulti({ task: updatedTask, queue, multi });
  multi.publish(
    getQueueTaskProgressUpdatedChannel({ queue }),
    serializeEvent({
      createdAt: new Date(),
      type: EventType.TaskProgressUpdated,
      task: updatedTask,
    }),
  );
  await exec(multi);
  return updatedTask;
};

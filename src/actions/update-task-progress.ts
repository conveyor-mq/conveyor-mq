import { Redis } from 'ioredis';
import { serializeTask } from '../domain/tasks/serialize-task';
import { exec } from '../utils/redis';
import { getTaskKey, getQueueTaskProgressUpdatedChannel } from '../utils/keys';
import { Task } from '../domain/tasks/task';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';

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
  const taskKey = getTaskKey({ taskId: task.id, queue });
  const updatedTask = { ...task, progress };
  const multi = client.multi();
  multi.hmset(
    taskKey,
    'progress',
    typeof progress === 'object' ? JSON.stringify(progress) : progress,
  );
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

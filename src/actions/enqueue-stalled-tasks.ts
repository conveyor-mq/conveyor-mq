import { Redis } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { getProcessingListKey, getStallingHashKey } from '../utils/keys';
import { exec } from '../utils/redis';
import { enqueueTasksMulti } from './enqueue-tasks';

/**
 * @ignore
 */
export const enqueueStalledTasks = async ({
  queue,
  tasks,
  client,
}: {
  queue: string;
  tasks: Task[];
  client: Redis;
}): Promise<Task[]> => {
  const multi = client.multi();
  const processingListKey = getProcessingListKey({ queue });
  const tasksToQueue: Task[] = tasks.map((task) => {
    multi.lrem(processingListKey, 1, task.id);
    multi.hdel(getStallingHashKey({ queue }), task.id);
    return {
      ...task,
      retries: (task.retries || 0) + 1,
      stallRetries: (task.stallRetries || 0) + 1,
    };
  });
  enqueueTasksMulti({
    tasks: tasksToQueue,
    queue,
    multi,
  });
  await exec(multi);
  return tasksToQueue;
};

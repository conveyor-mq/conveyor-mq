import { Redis } from 'ioredis';
import { map } from 'lodash';
import { getProcessingListKey, getStallingHashKey } from '../utils/keys';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
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
  const tasksToQueue: Task[] = map(tasks, (task) => {
    multi.lrem(processingListKey, 1, task.id);
    multi.hdel(getStallingHashKey({ queue }), task.id);
    return {
      ...task,
      retries: (task.retries || 0) + 1,
      stallRetries: (task.stallRetries || 0) + 1,
    };
  });
  await enqueueTasksMulti({
    tasks: tasksToQueue,
    queue,
    multi,
  });
  await exec(multi);
  return tasksToQueue;
};

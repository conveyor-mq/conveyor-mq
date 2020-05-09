import { Redis } from 'ioredis';
import { lrange } from '../utils/redis';
import { getProcessingListKey } from '../utils/keys';
import { getTasks } from './get-tasks';
import { Task } from '../domain/tasks/task';

// TODO: paging.
export const getProcessingTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const taskIds = await lrange({
    start: 0,
    stop: -1,
    client,
    key: getProcessingListKey({ queue }),
  });
  const tasks = await getTasks({ queue, taskIds, client });
  return tasks;
};

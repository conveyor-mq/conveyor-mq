import { RedisClient } from 'redis';
import { Task } from '../domain/task';
import { lrange } from '../utils/redis';
import { getProcessingListKey } from '../utils/keys';
import { getTasks } from './get-tasks';

// TODO: paging.
export const getProcessingTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: RedisClient;
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

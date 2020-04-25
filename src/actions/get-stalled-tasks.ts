import { RedisClient } from 'redis';
import { filter, map } from 'lodash';
import { Task } from '../domain/task';
import { lrange } from '../utils/redis';
import { getProcessingListKey } from '../utils/keys';
import { getTasks } from './get-tasks';
import { areTasksStalled } from './are-tasks-stalled';

// TODO: paging.
export const getStalledTasks = async ({
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
  const results = await areTasksStalled({ taskIds, queue, client });
  const stalledTasksIds = map(
    filter(results, (result) => result.isStalled),
    (result) => result.taskId,
  );
  const stalledTasks = await getTasks({
    queue,
    taskIds: stalledTasksIds,
    client,
  });
  return stalledTasks;
};

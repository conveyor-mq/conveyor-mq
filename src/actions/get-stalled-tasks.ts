import { filter, map } from 'lodash';
import { Redis } from 'ioredis';
import { lrange } from '../utils/redis';
import { getProcessingListKey } from '../utils/keys';
import { getTasks } from './get-tasks';
import { areTasksStalled } from './are-tasks-stalled';
import { Task } from '../domain/tasks/task';

// TODO: paging.
export const getStalledTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const taskIds = await lrange({
    key: getProcessingListKey({ queue }),
    start: 0,
    stop: -1,
    client,
  });
  const results = await areTasksStalled({ taskIds, queue, client });
  const stalledTasksIds = map(
    filter(results, (result) => !!result.isStalled),
    (result) => result.taskId,
  );
  const stalledTasks = await getTasks({
    queue,
    taskIds: stalledTasksIds,
    client,
  });
  return stalledTasks;
};

import { Redis } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { getProcessingListKey } from '../utils/keys';
import { lrange } from '../utils/redis';
import { areTasksStalled } from './are-tasks-stalled';
import { getTasksById } from './get-tasks-by-id';

// TODO: paging.
/**
 * @ignore
 */
export const getStalledTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const processingTaskIds = await lrange({
    key: getProcessingListKey({ queue }),
    start: 0,
    stop: -1,
    client,
  });
  const results = await areTasksStalled({
    taskIds: processingTaskIds,
    queue,
    client,
  });
  const stalledTasksIds = results
    .filter((result) => !!result.isStalled)
    .map((result) => result.taskId);
  const stalledTasks = await getTasksById({
    queue,
    taskIds: stalledTasksIds,
    client,
  });
  return stalledTasks;
};

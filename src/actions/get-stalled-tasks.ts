import map from 'lodash/map';
import filter from 'lodash/filter';
import { Redis } from 'ioredis';
import { lrange } from '../utils/redis';
import { getProcessingListKey } from '../utils/keys';
import { getTasksById } from './get-tasks-by-id';
import { areTasksStalled } from './are-tasks-stalled';
import { Task } from '../domain/tasks/task';

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
  const stalledTasksIds = map(
    filter(results, (result) => !!result.isStalled),
    (result) => result.taskId,
  );
  const stalledTasks = await getTasksById({
    queue,
    taskIds: stalledTasksIds,
    client,
  });
  return stalledTasks;
};

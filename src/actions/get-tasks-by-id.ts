import { Redis } from 'ioredis';
import { forEach, map, filter, isEmpty } from 'lodash';
import { getTaskKey } from '../utils/keys';
import { exec } from '../utils/redis';
import { taskFromJson } from '../domain/tasks/task-from-json';

/**
 * @ignore
 */
export const getTasksById = async ({
  queue,
  taskIds,
  client,
}: {
  queue: string;
  taskIds: string[];
  client: Redis;
}) => {
  const multi = client.multi();
  forEach(taskIds, (taskId) => {
    multi.hgetall(getTaskKey({ taskId, queue }));
  });
  const results = await exec(multi);
  const nonNullResults = filter(
    results,
    (result) => !!result && !isEmpty(result),
  ) as string[];
  const tasks = map(nonNullResults, (taskString) => taskFromJson(taskString));
  return tasks;
};

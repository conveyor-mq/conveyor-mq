import { Redis } from 'ioredis';
import { map } from 'lodash';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import { scheduleTaskMulti } from './schedule-task';

/**
 * @ignore
 */
export const scheduleTasks = async ({
  tasks,
  queue,
  client,
}: {
  tasks: Partial<Task>[];
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const multi = client.multi();
  const scheduledTasks = map(tasks, (task) =>
    scheduleTaskMulti({ task, queue, multi }),
  );
  await exec(multi);
  return scheduledTasks;
};

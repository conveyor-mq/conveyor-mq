import { Redis, Pipeline } from 'ioredis';
import { map } from 'lodash';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import { enqueueTaskMulti } from './enqueue-task';

/**
 * @ignore
 */
export const enqueueTasksMulti = ({
  tasks,
  queue,
  multi,
}: {
  tasks: Partial<Task>[];
  queue: string;
  multi: Pipeline;
}): Task[] => {
  const tasksToQueue = map(tasks, (task) =>
    enqueueTaskMulti({ task, queue, multi }),
  );
  return tasksToQueue;
};

/**
 * @ignore
 */
export const enqueueTasks = async ({
  tasks,
  queue,
  client,
}: {
  tasks: Partial<Task>[];
  queue: string;
  client: Redis;
}): Promise<Task[]> => {
  const multi = client.multi();
  const tasksToQueue = await enqueueTasksMulti({ tasks, queue, multi });
  await exec(multi);
  return tasksToQueue;
};

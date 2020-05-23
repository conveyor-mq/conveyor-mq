import { Redis, Pipeline } from 'ioredis';
import { enqueueTasksMulti } from './enqueue-tasks';
import { Task } from '../domain/tasks/task';
import { exec } from '../utils/redis';

/**
 * @ignore
 */
export const enqueueTaskMulti = async ({
  task,
  queue,
  multi,
}: {
  task: Partial<Task>;
  queue: string;
  multi: Pipeline;
}): Promise<Task> => {
  const [queuedTask] = await enqueueTasksMulti({ queue, tasks: [task], multi });
  return queuedTask;
};

/**
 * @ignore
 */
export const enqueueTask = async ({
  task,
  queue,
  client,
}: {
  task: Partial<Task>;
  queue: string;
  client: Redis;
}): Promise<Task> => {
  const multi = client.multi();
  const queuedTask = await enqueueTaskMulti({ task, queue, multi });
  await exec(multi);
  return queuedTask;
};

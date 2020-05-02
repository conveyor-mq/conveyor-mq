import { Redis } from 'ioredis';
import { Task } from '../domain/task';
import { enqueueTasks } from './enqueue-tasks';

export const enqueueTask = async ({
  queue,
  task,
  client,
}: {
  queue: string;
  task: Partial<Task>;
  client: Redis;
}): Promise<Task> => {
  const [queuedTask] = await enqueueTasks({ queue, tasks: [task], client });
  return queuedTask;
};

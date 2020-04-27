import { Redis } from 'ioredis';
import { Task } from '../domain/task';
import { putTasks } from './put-tasks';

export const putTask = async ({
  queue,
  task,
  client,
}: {
  queue: string;
  task: Partial<Task>;
  client: Redis;
}): Promise<Task> => {
  const [queuedTask] = await putTasks({ queue, tasks: [task], client });
  return queuedTask;
};

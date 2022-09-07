import { ChainableCommander, Redis } from 'ioredis';
import { Task } from '../domain/tasks/task';
import { exec } from '../utils/redis';
import {
  enqueueTaskMulti,
  OnAfterEnqueueTask,
  OnBeforeEnqueueTask,
} from './enqueue-task';

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
  multi: ChainableCommander;
}): Task[] => {
  const tasksToQueue = tasks.map((task) =>
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
  onBeforeEnqueueTask,
  onAfterEnqueueTask,
}: {
  tasks: Partial<Task>[];
  queue: string;
  client: Redis;
  onBeforeEnqueueTask?: OnBeforeEnqueueTask;
  onAfterEnqueueTask?: OnAfterEnqueueTask;
}): Promise<Task[]> => {
  const multi = client.multi();
  const tasksToQueue = await enqueueTasksMulti({ tasks, queue, multi });
  if (onBeforeEnqueueTask) {
    tasksToQueue.forEach((task) => {
      onBeforeEnqueueTask({ task, multi });
    });
  }
  await exec(multi);
  if (onAfterEnqueueTask) {
    tasksToQueue.forEach((task) => {
      onAfterEnqueueTask({ task });
    });
  }
  return tasksToQueue;
};

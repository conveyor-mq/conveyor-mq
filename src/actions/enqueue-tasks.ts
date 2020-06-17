import { Redis, Pipeline } from 'ioredis';
import { map, forEach } from 'lodash';
import { exec } from '../utils/redis';
import { Task } from '../domain/tasks/task';
import {
  enqueueTaskMulti,
  OnBeforeEnqueueTask,
  OnAfterEnqueueTask,
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
    forEach(tasksToQueue, (task) => {
      onBeforeEnqueueTask({ task, multi });
    });
  }
  await exec(multi);
  if (onAfterEnqueueTask) {
    forEach(tasksToQueue, (task) => {
      onAfterEnqueueTask({ task });
    });
  }
  return tasksToQueue;
};

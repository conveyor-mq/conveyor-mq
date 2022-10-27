import { ChainableCommander } from 'ioredis';
import { serializeTask } from '../domain/tasks/serialize-task';
import { Task } from '../domain/tasks/task';
import { getTaskKey } from '../utils/keys';

/**
 * @ignore
 */
export const persistTaskMulti = ({
  task,
  queue,
  multi,
}: {
  task: Task;
  queue: string;
  multi: ChainableCommander;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  multi.set(taskKey, serializeTask(task));
};

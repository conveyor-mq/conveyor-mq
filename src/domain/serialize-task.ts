import { Task } from './tasks/task';

export const serializeTask = (task: Task) => {
  return JSON.stringify(task);
};

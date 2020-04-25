import { Task } from './task';

export const serializeTask = (task: Task) => {
  return JSON.stringify(task);
};

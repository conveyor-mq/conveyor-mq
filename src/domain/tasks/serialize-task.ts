import { Task } from './task';
import { taskToJson } from './task-to-json';

export const serializeTask = (task: Task) => {
  return JSON.stringify(taskToJson(task));
};

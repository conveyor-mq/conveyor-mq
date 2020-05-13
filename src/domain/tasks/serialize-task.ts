import { Task } from './task';
import { taskToJson } from './task-to-json';

/**
 * @ignore
 */
export const serializeTask = (task: Task) => {
  return JSON.stringify(taskToJson(task));
};

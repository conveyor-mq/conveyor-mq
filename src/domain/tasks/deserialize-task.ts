import { Task } from './task';
import { taskFromJson } from './task-from-json';

/**
 * @ignore
 */
export const deSerializeTask = (taskString: string): Task => {
  return taskFromJson(JSON.parse(taskString));
};

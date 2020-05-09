import { Task } from './task';
import { taskFromJson } from './task-from-json';

export const deSerializeTask = (taskString: string): Task => {
  return taskFromJson(JSON.parse(taskString));
};

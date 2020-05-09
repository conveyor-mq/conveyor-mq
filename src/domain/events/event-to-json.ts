import { Event } from './event';
import { taskToJson } from '../tasks/task-to-json';

export const eventToJson = (event: Event) => {
  return {
    createdAt: event.createdAt.toISOString(),
    type: event.type,
    task: event.task ? taskToJson(event.task) : undefined,
  };
};

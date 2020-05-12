import { Event } from './event';
import { taskToJson } from '../tasks/task-to-json';
import { workerToJson } from '../workers/worker-to-json';

export const eventToJson = (event: Event) => {
  return {
    createdAt: event.createdAt.toISOString(),
    type: event.type,
    task: event.task ? taskToJson(event.task) : undefined,
    worker: event.worker ? workerToJson(event.worker) : undefined,
  };
};

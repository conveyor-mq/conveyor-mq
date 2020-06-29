import { Event } from './event';
import { taskFromJson } from '../tasks/task-from-json';
import { EventType } from './event-type';
import { workerFromJson } from '../worker/worker-from-json';

/**
 * @ignore
 */
export const eventFromJson = (eventJson: any): Event => {
  return {
    createdAt: new Date(eventJson.createdAt),
    type: eventJson.type as EventType,
    task: eventJson.task ? taskFromJson(eventJson.task) : undefined,
    worker: eventJson.worker ? workerFromJson(eventJson.worker) : undefined,
    data: eventJson.data,
  };
};

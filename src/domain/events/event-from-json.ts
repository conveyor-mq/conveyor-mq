import moment from 'moment';
import { Event } from './event';
import { taskFromJson } from '../tasks/task-from-json';
import { EventTypes } from './event-types';
import { workerFromJson } from '../workers/worker-from-json';

export const eventFromJson = (eventJson: any): Event => {
  return {
    createdAt: moment(eventJson.createdAt),
    type: eventJson.type as EventTypes,
    task: eventJson.task ? taskFromJson(eventJson.task) : undefined,
    worker: eventJson.worker ? workerFromJson(eventJson.worker) : undefined,
  };
};

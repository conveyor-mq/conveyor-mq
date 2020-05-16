import { Task } from '../tasks/task';
import { EventTypes } from './event-types';
import { Worker } from '../workers/worker';

export interface Event {
  createdAt: Date;
  type: EventTypes;
  task?: Task;
  worker?: Worker;
}

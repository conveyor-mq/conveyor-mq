import { Task } from '../tasks/task';
import { EventType } from './event-type';
import { Worker } from '../workers/worker';

export interface Event {
  createdAt: Date;
  type: EventType;
  task?: Task;
  worker?: Worker;
}

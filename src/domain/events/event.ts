import { Moment } from 'moment';
import { Task } from '../tasks/task';
import { EventTypes } from './event-types';
import { Worker } from '../workers/worker';

export interface Event {
  createdAt: Moment;
  type: EventTypes;
  task?: Task;
  worker?: Worker;
}

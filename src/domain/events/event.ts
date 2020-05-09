import { Moment } from 'moment';
import { Task } from '../tasks/task';
import { EventTypes } from './event-types';

export interface Event {
  createdAt: Moment;
  type: EventTypes;
  task?: Task;
}

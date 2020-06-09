import { Task } from '../tasks/task';
import { EventType } from './event-type';
import { WorkerInstance } from '../worker/worker-instance';

export interface Event {
  createdAt: Date;
  type: EventType;
  task?: Task;
  worker?: WorkerInstance;
}

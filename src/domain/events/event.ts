import { Task } from '../tasks/task';
import { EventType } from './event-type';
import { WorkerInstance } from '../worker/worker-instance';
import { QueueRateLimitConfig } from '../../actions/get-queue-rate-limit-config';

export interface Event {
  createdAt: Date;
  type: EventType;
  task?: Task;
  worker?: WorkerInstance;
  data?: {
    rateLimitConfig?: QueueRateLimitConfig;
  };
}

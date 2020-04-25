import { Moment } from 'moment';
import { TaskStatuses } from './task-statuses';

export interface Task {
  id: string;
  status?: TaskStatuses;
  data?: any;
  result?: any;
  error?: any;
  expiresOn?: Moment;
  maxAttempts?: number;
  attemptCount?: number;
  stalledAfter?: number;
  queuedOn?: Moment;
  processingStartedOn?: Moment;
  processingEndedOn?: Moment;
}

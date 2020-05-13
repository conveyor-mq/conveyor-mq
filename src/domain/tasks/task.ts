import { Moment } from 'moment';
import { TaskStatuses } from './task-statuses';

export interface Task {
  id: string;
  status?: TaskStatuses;
  data?: any;
  queuedOn?: Moment;
  expiresOn?: Moment;
  processingStartedOn?: Moment;
  processingEndedOn?: Moment;
  attemptCount?: number;
  maxAttemptCount?: number;
  errorCount?: number;
  maxErrorCount?: number;
  retryBackoff?: {
    strategy: 'constant' | 'linear' | 'exponential' | string;
    factor: number;
  };
  result?: any;
  error?: any;
}

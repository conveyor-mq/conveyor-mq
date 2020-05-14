import { Moment } from 'moment';
import { TaskStatuses } from './task-statuses';

export interface Task {
  id: string;
  status?: TaskStatuses;
  data?: any;
  queuedAt?: Moment;
  expiresAt?: Moment;
  executionTimeout?: number;
  processingStartedAt?: Moment;
  processingEndedAt?: Moment;
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

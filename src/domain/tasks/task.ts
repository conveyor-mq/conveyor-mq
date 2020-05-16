import { Moment } from 'moment';
import { TaskStatuses } from './task-statuses';

export interface Task {
  id: string;
  status?: TaskStatuses;
  data?: any;
  queuedAt?: Moment;
  enqueueAfter?: Moment;
  expiresAt?: Moment;
  executionTimeout?: number;
  processingStartedAt?: Moment;
  processingEndedAt?: Moment;
  stallTimeout?: number;
  taskAcknowledgementInterval?: number;
  retries?: number;
  retryLimit?: number | null;
  errorRetries?: number;
  errorRetryLimit?: number | null;
  stallRetries?: number;
  stallRetryLimit?: number | null;
  retryBackoff?: {
    strategy: 'constant' | 'linear' | 'exponential' | string;
    factor: number;
  };
  result?: any;
  error?: any;
  progress?: any;
}

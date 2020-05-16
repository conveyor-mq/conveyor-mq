import { TaskStatuses } from './task-statuses';

export interface Task {
  id: string;
  status?: TaskStatuses;
  data?: any;
  queuedAt?: Date;
  enqueueAfter?: Date;
  expiresAt?: Date;
  executionTimeout?: number;
  processingStartedAt?: Date;
  processingEndedAt?: Date;
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
  removeOnSuccess?: boolean;
  removeOnFailed?: boolean;
}

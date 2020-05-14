import moment from 'moment';
import { Task } from './task';

/**
 * @ignore
 */
export const taskFromJson = (taskJson: any): Task => {
  return {
    id: taskJson.id,
    status: taskJson.status,
    data: taskJson.data,
    queuedAt: taskJson.queuedAt ? moment(taskJson.queuedAt) : undefined,
    enqueueAfter: taskJson.enqueueAfter
      ? moment(taskJson.enqueueAfter)
      : undefined,
    expiresAt: taskJson.expiresAt ? moment(taskJson.expiresAt) : undefined,
    executionTimeout: taskJson.executionTimeout,
    processingStartedAt: taskJson.processingStartedAt
      ? moment(taskJson.processingStartedAt)
      : undefined,
    processingEndedAt: taskJson.processingEndedAt
      ? moment(taskJson.processingEndedAt)
      : undefined,
    attemptCount: taskJson.attemptCount,
    maxAttemptCount: taskJson.maxAttemptCount,
    errorCount: taskJson.errorCount,
    maxErrorCount: taskJson.maxErrorCount,
    retryBackoff: taskJson.retryBackoff,
    result: taskJson.result,
    error: taskJson.error,
  };
};

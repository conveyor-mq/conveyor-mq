import { Task } from './task';

/**
 * @ignore
 */
export const taskToJson = (task: Task) => {
  return {
    id: task.id,
    status: task.status,
    data: task.data,
    queuedAt: task.queuedAt ? task.queuedAt.toISOString() : undefined,
    enqueueAfter: task.enqueueAfter
      ? task.enqueueAfter.toISOString()
      : undefined,
    expiresAt: task.expiresAt ? task.expiresAt.toISOString() : undefined,
    executionTimeout: task.executionTimeout,
    processingStartedAt: task.processingStartedAt
      ? task.processingStartedAt.toISOString()
      : undefined,
    processingEndedAt: task.processingEndedAt
      ? task.processingEndedAt.toISOString()
      : undefined,
    attemptCount: task.attemptCount,
    maxAttemptCount: task.maxAttemptCount,
    errorCount: task.errorCount,
    maxErrorCount: task.maxErrorCount,
    retryBackoff: task.retryBackoff,
    result: task.result,
    error: task.error,
  };
};

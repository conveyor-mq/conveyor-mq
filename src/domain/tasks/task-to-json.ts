import { Task } from './task';

/**
 * @ignore
 */
export const taskToJson = (task: Task) => {
  return {
    id: task.id,
    status: task.status,
    data: task.data,
    queuedOn: task.queuedOn ? task.queuedOn.toISOString() : undefined,
    expiresOn: task.expiresOn ? task.expiresOn.toISOString() : undefined,
    executionTimeout: task.executionTimeout,
    processingStartedOn: task.processingStartedOn
      ? task.processingStartedOn.toISOString()
      : undefined,
    processingEndedOn: task.processingEndedOn
      ? task.processingEndedOn.toISOString()
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

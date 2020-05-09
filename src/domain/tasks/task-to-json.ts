import { Task } from './task';

export const taskToJson = (task: Task) => {
  return {
    id: task.id,
    status: task.status,
    data: task.data,
    queuedOn: task.queuedOn ? task.queuedOn.toISOString() : undefined,
    expiresOn: task.expiresOn ? task.expiresOn.toISOString() : undefined,
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
    result: task.result,
    error: task.error,
  };
};

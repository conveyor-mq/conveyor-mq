import { Task } from './task';

/**
 * @ignore
 */
export const taskFromJson = (taskJson: any): Task => {
  return {
    id: taskJson.id,
    status: taskJson.status,
    data: taskJson.data,
    queuedAt: taskJson.queuedAt ? new Date(taskJson.queuedAt) : undefined,
    enqueueAfter: taskJson.enqueueAfter
      ? new Date(taskJson.enqueueAfter)
      : undefined,
    expiresAt: taskJson.expiresAt ? new Date(taskJson.expiresAt) : undefined,
    executionTimeout: taskJson.executionTimeout,
    processingStartedAt: taskJson.processingStartedAt
      ? new Date(taskJson.processingStartedAt)
      : undefined,
    processingEndedAt: taskJson.processingEndedAt
      ? new Date(taskJson.processingEndedAt)
      : undefined,
    retries: taskJson.retries,
    retryLimit: taskJson.retryLimit,
    errorRetries: taskJson.errorRetries,
    errorRetryLimit: taskJson.errorRetryLimit,
    stallRetries: taskJson.stallRetries,
    stallRetryLimit: taskJson.stallRetryLimit,
    retryBackoff: taskJson.retryBackoff,
    result: taskJson.result,
    error: taskJson.error,
    progress: taskJson.progress,
  };
};

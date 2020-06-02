import { Task } from './task';

const numberOrUndefined = (x: string) =>
  x !== undefined ? JSON.parse(x) : undefined;

const bleh = (x: string) => {
  const result = parseInt(x, 10);
  // eslint-disable-next-line no-restricted-globals
  return isNaN(result) ? x : result;
};

/**
 * @ignore
 */
export const taskFromJson = (taskJson: any): Task => {
  return {
    id: taskJson.id,
    status: taskJson.status,
    data: taskJson.data,
    createdAt: taskJson.createdAt ? new Date(taskJson.createdAt) : undefined,
    queuedAt: taskJson.queuedAt ? new Date(taskJson.queuedAt) : undefined,
    enqueueAfter: taskJson.enqueueAfter
      ? new Date(taskJson.enqueueAfter)
      : undefined,
    expiresAt: taskJson.expiresAt ? new Date(taskJson.expiresAt) : undefined,
    executionTimeout: numberOrUndefined(taskJson.executionTimeout),
    processingStartedAt: taskJson.processingStartedAt
      ? new Date(taskJson.processingStartedAt)
      : undefined,
    processingEndedAt: taskJson.processingEndedAt
      ? new Date(taskJson.processingEndedAt)
      : undefined,
    retries: numberOrUndefined(taskJson.retries),
    retryLimit: numberOrUndefined(taskJson.retryLimit),
    errorRetries: numberOrUndefined(taskJson.errorRetries),
    errorRetryLimit: numberOrUndefined(taskJson.errorRetryLimit),
    stallRetries: numberOrUndefined(taskJson.stallRetries),
    stallRetryLimit: numberOrUndefined(taskJson.stallRetryLimit),
    retryBackoff: taskJson.retryBackoff,
    result: taskJson.result,
    error: taskJson.error,
    progress: bleh(taskJson.progress),
    removeOnSuccess: taskJson.removeOnSuccess,
    removeOnFailed: taskJson.removeOnFailed,
  };
};

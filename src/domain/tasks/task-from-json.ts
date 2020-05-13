import moment from 'moment';
import { Task } from './task';

export const taskFromJson = (taskJson: any): Task => {
  return {
    id: taskJson.id,
    status: taskJson.status,
    data: taskJson.data,
    queuedOn: taskJson.queuedOn ? moment(taskJson.queuedOn) : undefined,
    expiresOn: taskJson.expiresOn ? moment(taskJson.expiresOn) : undefined,
    processingStartedOn: taskJson.processingStartedOn
      ? moment(taskJson.processingStartedOn)
      : undefined,
    processingEndedOn: taskJson.processingEndedOn
      ? moment(taskJson.processingEndedOn)
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

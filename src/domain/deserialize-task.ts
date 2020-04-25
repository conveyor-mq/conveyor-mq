import moment from 'moment';
import { Task } from './task';

export const deSerializeTask = (taskString: string): Task => {
  const taskJson = JSON.parse(taskString);
  return {
    id: taskJson.id,
    status: taskJson.status,
    data: taskJson.data,
    result: taskJson.result,
    error: taskJson.error,
    expiresOn: taskJson.expiresOn ? moment(taskJson.expiresOn) : undefined,
    maxAttempts: taskJson.maxAttempts,
    attemptCount: taskJson.attemptCount,
    stalledAfter: taskJson.stalledAfter,
    queuedOn: taskJson.queuedOn ? moment(taskJson.queuedOn) : undefined,
    processingStartedOn: taskJson.processingStartedOn
      ? moment(taskJson.processingStartedOn)
      : undefined,
    processingEndedOn: taskJson.processingEndedOn
      ? moment(taskJson.processingEndedOn)
      : undefined,
  };
};

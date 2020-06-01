import { Pipeline } from 'ioredis';
import { pickBy } from 'lodash';
import { getTaskKey } from '../utils/keys';
import { Task } from '../domain/tasks/task';

export const persistTaskMulti = ({
  taskId,
  taskData,
  queue,
  multi,
}: {
  taskId: string;
  taskData: Partial<Task>;
  queue: string;
  multi: Pipeline;
}) => {
  const fields: { [key: string]: string | number | undefined } = {
    id: taskData.id,
    status: taskData.status,
    data: JSON.stringify(taskData.data),
    createdAt: taskData.createdAt?.toISOString(),
    queuedAt: taskData.queuedAt?.toISOString(),
    enqueueAfter: taskData.enqueueAfter?.toISOString(),
    expiresAt: taskData.expiresAt?.toISOString(),
    executionTimeout: taskData.executionTimeout,
    processingStartedAt: taskData.processingEndedAt?.toISOString(),
    processingEndedAt: taskData.processingEndedAt?.toISOString(),
    stallTimeout: taskData.stallTimeout,
    taskAcknowledgementInterval: taskData.taskAcknowledgementInterval,
    retries: taskData.retries,
    retryLimit: taskData.retryLimit || undefined,
    errorRetries: taskData.errorRetries,
    errorRetryLimit: taskData.errorRetryLimit || undefined,
    stallRetries: taskData.stallRetries,
    stallRetryLimit: taskData.stallRetryLimit || undefined,
    retryBackoff: JSON.stringify(taskData.retryBackoff),
    result: taskData.result,
    error: taskData.error,
    progress: taskData.progress,
    removeOnSuccess: JSON.stringify(taskData.removeOnSuccess),
    removeOnFailed: JSON.stringify(taskData.removeOnFailed),
  };
  const definedFields = pickBy(fields, (value) => value !== undefined) as {
    [key: string]: string | number;
  };
  const args = Object.keys(definedFields).reduce<(string | number)[]>(
    (acc, curr) =>
      definedFields[curr] ? [...acc, curr, definedFields[curr]] : acc,
    [],
  );
  multi.hmset(getTaskKey({ taskId, queue }), ...args);
};

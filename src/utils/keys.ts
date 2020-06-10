/*
  Data structure keys:
*/

export const getQueueRateLimitKey = ({ queue }: { queue: string }) => {
  return `${queue}:rate-limit`;
};

export const getQueuePausedKey = ({ queue }: { queue: string }) => {
  return `${queue}:is-paused`;
};

export const getWorkerKeyPrefix = ({ queue }: { queue: string }) => {
  return `${queue}:worker:`;
};

export const getWorkerKey = ({
  workerId,
  queue,
}: {
  workerId: string;
  queue: string;
}) => {
  return `${getWorkerKeyPrefix({ queue })}${workerId}`;
};

export const getTaskKeyPrefix = ({ queue }: { queue: string }) => {
  return `${queue}:tasks:`;
};

export const getTaskKey = ({
  taskId,
  queue,
}: {
  taskId: string;
  queue: string;
}) => {
  return `${getTaskKeyPrefix({ queue })}${taskId}`;
};

export const getTaskAcknowledgedKey = ({
  taskId,
  queue,
}: {
  taskId: string;
  queue: string;
}) => {
  return `${queue}:acknowledged-tasks:${taskId}`;
};

export const getScheduledSetKey = ({ queue }: { queue: string }) =>
  `${queue}:sets:scheduled`;

export const getQueuedListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:queued`;

export const getPausedListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:paused`;

export const getProcessingListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:processing`;

export const getSuccessListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:success`;

export const getFailedListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:failed`;

export const getStallingHashKey = ({ queue }: { queue: string }) =>
  `queue:${queue}:stalling-tasks`;

/*
  Channels
*/
export const getWorkerPausedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:worker-paused`;

export const getWorkerStartedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:worker-started`;

export const getWorkerShutdownChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:worker-shutdown`;

export const getQueueTaskQueuedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-queued`;

export const getQueueTaskScheduledChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-scheduled`;

export const getQueueTaskUpdatedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-updated`;

export const getQueueTaskProgressUpdatedChannel = ({
  queue,
}: {
  queue: string;
}) => `queue:${queue}:task-progress-updated`;

export const getQueueTaskProcessingChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-processing`;

export const getQueueTaskSuccessChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-success`;

export const getQueueTaskErrorChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-error`;

export const getQueueTaskStalledChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-stalled`;

export const getQueueTaskFailedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-fail`;

export const getQueueTaskCompleteChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-complete`;

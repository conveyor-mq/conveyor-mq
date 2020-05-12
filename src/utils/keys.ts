export const getStallingHashKey = ({ queue }: { queue: string }) =>
  `queue:${queue}:stalling-tasks`;

export const getWorkerPausedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:worker-paused`;

export const getWorkerStartedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:worker-started`;

export const getWorkerShutdownChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:worker-shutdown`;

export const getQueueTaskQueuedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-queued`;

export const getQueueTaskUpdatedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-updated`;

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

export const getTaskKey = ({
  taskId,
  queue,
}: {
  taskId: string;
  queue: string;
}) => {
  return `${queue}:tasks:${taskId}`;
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

export const getQueuedListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:queued`;

export const getProcessingListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:processing`;

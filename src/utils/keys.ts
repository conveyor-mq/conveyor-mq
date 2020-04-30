export const getTaskQueuedChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-queued`;

export const getTaskProcessingChannel = ({ queue }: { queue: string }) =>
  `queue:${queue}:task-processing`;

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

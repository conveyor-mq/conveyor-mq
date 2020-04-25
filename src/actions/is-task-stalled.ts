import { RedisClient } from 'redis';
import { areTasksStalled } from './are-tasks-stalled';

export const isTaskStalled = async ({
  taskId,
  queue,
  client,
}: {
  taskId: string;
  queue: string;
  client: RedisClient;
}) => {
  const [result] = await areTasksStalled({
    taskIds: [taskId],
    queue,
    client,
  });
  return result.isStalled;
};

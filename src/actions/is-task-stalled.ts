import { Redis } from 'ioredis';
import { areTasksStalled } from './are-tasks-stalled';

/**
 * @ignore
 */
export const isTaskStalled = async ({
  taskId,
  queue,
  client,
}: {
  taskId: string;
  queue: string;
  client: Redis;
}) => {
  const [result] = await areTasksStalled({
    taskIds: [taskId],
    queue,
    client,
  });
  return result.isStalled;
};

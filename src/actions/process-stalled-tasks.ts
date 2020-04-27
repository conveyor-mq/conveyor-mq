import { Redis } from 'ioredis';
import { getStalledTasks, handleStalledTasks } from '..';

export const processStalledTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const stalledTasks = await getStalledTasks({ queue, client });
  const { failedTasks, reQueuedTasks } = await handleStalledTasks({
    queue,
    client,
    tasks: stalledTasks,
  });
  return { stalledTasks, failedTasks, reQueuedTasks };
};

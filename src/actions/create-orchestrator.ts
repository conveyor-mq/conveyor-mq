import {
  setIntervalAsync,
  clearIntervalAsync,
} from 'set-interval-async/dynamic';
import { processStalledTasks } from './process-stalled-tasks';
import { createClient, quit } from '../utils/redis';
import { RedisConfig } from '../utils/general';

export const createOrchestrator = async ({
  queue,
  redisConfig,
  stalledCheckInterval = 1000,
}: {
  queue: string;
  redisConfig: RedisConfig;
  stalledCheckInterval?: number;
}) => {
  const client = await createClient(redisConfig);

  const reQueueStalledTasks = async () => {
    console.log('Checking for stalled tasks.');
    try {
      const {
        stalledTasks,
        reQueuedTasks,
        failedTasks,
      } = await processStalledTasks({ queue, client });
      console.log('Stalled tasks:', stalledTasks.length);
      console.log('Requeued stalled tasks:', reQueuedTasks.length);
      console.log('Failed stalled tasks:', failedTasks.length);
    } catch (e) {
      console.error(e.toString());
    }
  };

  const stalledTimer = await setIntervalAsync(
    () => reQueueStalledTasks(),
    stalledCheckInterval,
  );

  return {
    quit: async () => {
      await Promise.all([quit({ client }), clearIntervalAsync(stalledTimer)]);
    },
  };
};

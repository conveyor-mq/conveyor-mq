import {
  setIntervalAsync,
  clearIntervalAsync,
} from 'set-interval-async/dynamic';
import { map } from 'lodash';
import { processStalledTasks as processStalledTasksAction } from './process-stalled-tasks';
import { enqueueDelayedTasks as enqueueDelayedTasksAction } from './enqueue-delayed-tasks';
import { createClient, quit as redisQuit } from '../utils/redis';
import { RedisConfig } from '../utils/general';

export const createOrchestrator = async ({
  queue,
  redisConfig,
  stalledCheckInterval = 1000,
  delayedTasksCheckInterval = 1000,
}: {
  queue: string;
  redisConfig: RedisConfig;
  stalledCheckInterval?: number;
  delayedTasksCheckInterval?: number;
}) => {
  const client = await createClient(redisConfig);

  const processStalledTasks = async () => {
    console.log('Checking for stalled tasks.');
    try {
      const {
        stalledTasks,
        reQueuedTasks,
        failedTasks,
      } = await processStalledTasksAction({ queue, client });
      console.log('Stalled tasks:', stalledTasks.length);
      console.log('Requeued stalled tasks:', reQueuedTasks.length);
      console.log('Failed stalled tasks:', failedTasks.length);
    } catch (e) {
      console.error(e.toString());
    }
  };
  const stalledTimer = await setIntervalAsync(
    () => processStalledTasks(),
    stalledCheckInterval,
  );

  const enqueueDelayedTasks = async () => {
    console.log('Checking for delayed tasks.');
    try {
      const enqueuedTasks = await enqueueDelayedTasksAction({ queue, client });
      console.log('Enqueued delayed tasks:', enqueuedTasks.length);
    } catch (e) {
      console.error(e.toString());
    }
  };
  const enqueueDelayedTasksTimer = await setIntervalAsync(
    () => enqueueDelayedTasks(),
    delayedTasksCheckInterval,
  );

  const quit = async () => {
    await Promise.all([
      redisQuit({ client }),
      map([stalledTimer, enqueueDelayedTasksTimer], (timer) =>
        clearIntervalAsync(timer),
      ),
    ]);
  };

  return {
    quit,
  };
};

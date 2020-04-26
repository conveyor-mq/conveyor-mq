import { Redis } from 'ioredis';
import moment from 'moment';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { clearIntervalAsync, SetIntervalAsyncTimer } from 'set-interval-async';
import { map } from 'lodash';
import { Task } from '../domain/task';
import { handleTask, getRetryDelayType } from './handle-task';
import { linear } from '../utils/retry-strategies';
import { getStalledTasks } from './get-stalled-tasks';
import { quit, duplicateClient } from '../utils/redis';
import { handleStalledTasks } from './handle-stalled-tasks';
import { takeTask } from './take-task';
import { sleep } from '../utils/general';

export const registerHandler = async ({
  queue,
  handler,
  client,
  concurrency = 1,
  getRetryDelay = linear(),
  stallDuration = 1000,
  stalledCheckInterval = 10000,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
  onHandlerError,
}: {
  queue: string;
  handler: ({ task }: { task: Task }) => any;
  client: Redis;
  concurrency?: number;
  getRetryDelay?: getRetryDelayType;
  stallDuration?: number;
  stalledCheckInterval?: number;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
}) => {
  const clients: Redis[] = [];
  const intervalTimers: SetIntervalAsyncTimer[] = [];

  const adminClient = await duplicateClient(client);
  clients.push(adminClient);

  const reQueueStalledTasks = async () => {
    console.log('Checking for stalled tasks.');
    try {
      const stalledTasks = await getStalledTasks({
        queue,
        client: adminClient,
      });
      const { failedTasks, reQueuedTasks } = await handleStalledTasks({
        queue,
        client: adminClient,
        tasks: stalledTasks,
      });
      if (failedTasks.length > 0) {
        console.log(`Failed ${stalledTasks.length} stalled tasks.`);
      }
      if (reQueueStalledTasks.length > 0) {
        console.log(`ReQueued ${reQueuedTasks.length} stalled tasks.`);
      }
      if (stalledTasks.length === 0) {
        console.log('No stalled tasks.');
      }
    } catch (e) {
      console.error(e.toString());
    }
  };
  const stalledTimer = await setIntervalAsync(
    () => reQueueStalledTasks(),
    stalledCheckInterval,
  );
  intervalTimers.push(stalledTimer);

  const checkForAndHandleTask = async (localClient: Redis) => {
    try {
      const task = await takeTask({
        queue,
        client: localClient,
        stallDuration,
      });
      if (task) {
        await handleTask({
          task,
          queue,
          client: localClient,
          asOf: moment(),
          handler,
          getRetryDelay,
          onTaskSuccess,
          onTaskError,
          onTaskFailed,
        });
        checkForAndHandleTask(localClient);
      }
      await sleep(1000);
      checkForAndHandleTask(localClient);
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      checkForAndHandleTask(localClient);
    }
  };

  const localClients = await Promise.all(
    map(Array.from({ length: concurrency }), async () => {
      const localClient = await duplicateClient(client);
      checkForAndHandleTask(localClient);
      return localClient;
    }),
  );
  clients.push(...localClients);

  return {
    quit: async () => {
      await Promise.all(
        map(intervalTimers, (timer) => clearIntervalAsync(timer)),
      );
      await Promise.all(
        map(clients, (localClient) => quit({ client: localClient })),
      );
    },
  };
};

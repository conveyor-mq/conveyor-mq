import { RedisClient } from 'redis';
import moment from 'moment';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { clearIntervalAsync, SetIntervalAsyncTimer } from 'set-interval-async';
import { map } from 'lodash';
import { Task } from '../domain/task';
import { takeTaskBlocking } from './take-task-blocking';
import { handleTask, getRetryDelayType } from './handle-task';
import { linear } from '../utils/retry-strategies';
import { getStalledTasks } from './get-stalled-tasks';
import { quit } from '../utils/redis';
import { handleStalledTasks } from './handle-stalled-tasks';

export const registerHandler = async ({
  queue,
  handler,
  client,
  concurrency = 1,
  getRetryDelay = linear(),
  stallDuration = 100000,
  stalledCheckInterval = 1000,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
  onHandlerError,
}: {
  queue: string;
  handler: ({ task }: { task: Task }) => any;
  client: RedisClient;
  concurrency?: number;
  getRetryDelay?: getRetryDelayType;
  stallDuration?: number;
  stalledCheckInterval?: number;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
}) => {
  const clients: RedisClient[] = [];
  const intervalTimers: SetIntervalAsyncTimer[] = [];

  const adminClient = client.duplicate();
  clients.push(adminClient);

  const reQueueStalledTasks = async () => {
    try {
      const stalledTasks = await getStalledTasks({
        queue,
        client: adminClient,
      });
      const { failedTasks, reQueuedTasks } = await handleStalledTasks({
        queue,
        client,
        tasks: stalledTasks,
      });
      if (failedTasks.length > 0) {
        console.log(`Failed ${stalledTasks.length} stalled tasks.`);
        console.log(failedTasks);
      }
      if (reQueueStalledTasks.length > 0) {
        console.log(`ReQueued ${reQueuedTasks.length} stalled tasks.`);
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

  const checkForAndHandleTask = async (localClient: RedisClient) => {
    try {
      const task = await takeTaskBlocking({ queue, client, stallDuration });
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
      }
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
    }
  };
  const timersAndClients = await Promise.all(
    map(Array.from({ length: concurrency }), async () => {
      const localClient = client.duplicate();
      const timer = await setIntervalAsync(
        () => checkForAndHandleTask(localClient),
        10,
      );
      return { timer, client: localClient };
    }),
  );
  clients.push(...map(timersAndClients, (t) => t.client));
  intervalTimers.push(...map(timersAndClients, (t) => t.timer));

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

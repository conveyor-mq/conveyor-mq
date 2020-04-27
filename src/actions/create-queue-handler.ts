import { Redis } from 'ioredis';
import { map } from 'lodash';
import { processTask } from './process-task';
import { sleep, RedisConfig } from '../utils/general';
import { Task } from '../domain/task';
import { getRetryDelayType } from './handle-task';
import { createClient, quit } from '../utils/redis';

export const createQueueHandler = async ({
  queue,
  redisConfig,
  stallDuration = 1000,
  handler,
  concurrency = 1,
  getRetryDelay,
  onTaskSuccess,
  onTaskError,
  onTaskFailed,
  onHandlerError,
}: {
  queue: string;
  redisConfig: RedisConfig;
  stallDuration?: number;
  handler: ({ task }: { task: Task }) => any;
  concurrency?: number;
  getRetryDelay?: getRetryDelayType;
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
}) => {
  const clients: Redis[] = [];

  const checkForAndHandleTask = async (localClient: Redis) => {
    try {
      const task = await processTask({
        queue,
        client: localClient,
        stallDuration,
        handler,
        getRetryDelay,
        onTaskSuccess,
        onTaskError,
        onTaskFailed,
      });
      if (task) {
        checkForAndHandleTask(localClient);
      } else {
        await sleep(1000);
        checkForAndHandleTask(localClient);
      }
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      checkForAndHandleTask(localClient);
    }
  };

  const localClients = await Promise.all(
    map(Array.from({ length: concurrency }), async () => {
      const localClient = await createClient(redisConfig);
      checkForAndHandleTask(localClient);
      return localClient;
    }),
  );
  clients.push(...localClients);

  return {
    quit: async () => {
      await Promise.all(
        map(clients, (localClient) => quit({ client: localClient })),
      );
    },
  };
};

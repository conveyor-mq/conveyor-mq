import { Redis } from 'ioredis';
import { map } from 'lodash';
import moment from 'moment';
import { RedisConfig } from '../utils/general';
import { Task } from '../domain/task';
import { getRetryDelayType, handleTask } from './handle-task';
import { createClient, quit } from '../utils/redis';
import { takeTaskBlocking } from './take-task-blocking';
import { takeTask } from './take-task';

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
  const [client1, client2] = await Promise.all([
    createClient(redisConfig),
    createClient(redisConfig),
  ]);

  const processTask = async ({ task }: { task: Task }) => {
    await handleTask({
      task,
      queue,
      client: client2,
      asOf: moment(),
      handler,
      getRetryDelay,
      onTaskSuccess,
      onTaskError,
      onTaskFailed,
    });
  };

  const checkForAndHandleTask = async ({
    block = true,
  }: {
    block: boolean;
  }) => {
    try {
      const taskTaker = block ? takeTaskBlocking : takeTask;
      const task = await taskTaker({
        queue,
        client: client1,
        stallDuration,
      });
      if (task) {
        checkForAndHandleTask({ block: false });
        processTask({ task });
      } else {
        checkForAndHandleTask({ block: true });
      }
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      checkForAndHandleTask({ block: true });
    }
  };
  checkForAndHandleTask({ block: true });

  return {
    quit: async () => {
      await Promise.all(
        map([client1, client2], (localClient) => quit({ client: localClient })),
      );
    },
  };
};

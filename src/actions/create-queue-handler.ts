import { map } from 'lodash';
import moment from 'moment';
import PQueue from 'p-queue';
import {
  setIntervalAsync,
  clearIntervalAsync,
} from 'set-interval-async/dynamic';
import { RedisConfig } from '../utils/general';
import { Task } from '../domain/task';
import { getRetryDelayType, handleTask } from './handle-task';
import { createClient, quit } from '../utils/redis';
import { acknowledgeTask } from './acknowledge-task';
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
  const promiseQueue = new PQueue({ concurrency });

  const [client1, client2] = await Promise.all([
    createClient(redisConfig),
    createClient(redisConfig),
  ]);

  const checkForAndHandleTask = async ({
    block = true,
  }: {
    block?: boolean;
  }) => {
    try {
      const taskTaker = block ? takeTaskBlocking : takeTask;
      const task = await taskTaker({
        queue,
        client: client1,
        stallDuration,
      });
      if (task) {
        const timer = setIntervalAsync(async () => {
          await acknowledgeTask({
            taskId: task.id,
            queue,
            client: client2,
            ttl: stallDuration,
          });
        }, stallDuration / 2);
        await handleTask({
          task,
          queue,
          handler,
          client: client2,
          asOf: moment(),
          getRetryDelay,
          onTaskSuccess,
          onTaskError,
          onTaskFailed,
        });
        await clearIntervalAsync(timer);
      }
      promiseQueue.add(() => checkForAndHandleTask({ block: !task }));
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      promiseQueue.add(() => checkForAndHandleTask({ block: false }));
    }
  };

  promiseQueue.addAll(
    map(Array.from({ length: concurrency }), () => () =>
      checkForAndHandleTask({ block: false }),
    ),
  );

  return {
    quit: async () => {
      await Promise.all(
        map([client1, client2], (localClient) => quit({ client: localClient })),
      );
    },
  };
};

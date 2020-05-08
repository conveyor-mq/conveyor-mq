import { map } from 'lodash';
import PQueue from 'p-queue';
import { RedisConfig, sleep } from '../utils/general';
import { Task } from '../domain/task';
import { getRetryDelayType } from './handle-task';
import { createClient, quit } from '../utils/redis';
import { takeTaskBlocking } from './take-task-blocking';
import { takeTask } from './take-task';
import { processTask } from './process-task';

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
  onIdle,
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
  onIdle?: () => any;
}) => {
  const takerQueue = new PQueue({ concurrency });
  const workerQueue = new PQueue({ concurrency });

  if (onIdle) workerQueue.on('idle', onIdle);

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
        workerQueue.add(async () => {
          await processTask({
            task,
            queue,
            client: client2,
            handler,
            stallDuration,
            getRetryDelay,
            onTaskSuccess,
            onTaskError,
            onTaskFailed,
          });
          await takerQueue.add(() => checkForAndHandleTask({ block: !task }));
        });
      }
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      await sleep(1000);
      await takerQueue.add(() => checkForAndHandleTask({ block: false }));
    }
  };

  takerQueue.addAll(
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

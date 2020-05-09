import { map, debounce } from 'lodash';
import PQueue from 'p-queue';
import { RedisConfig, sleep } from '../utils/general';
import { getRetryDelayType } from './handle-task';
import { createClient, quit as quitClient } from '../utils/redis';
import { takeTaskBlocking } from './take-task-blocking';
import { takeTask } from './take-task';
import { processTask } from './process-task';
import { Task } from '../domain/tasks/task';

export const createWorker = async ({
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
  idleTimeout = 250,
  onReady,
  autoStart = true,
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
  idleTimeout?: number;
  onReady?: () => any;
  autoStart?: boolean;
}) => {
  const takerQueue = new PQueue({ concurrency, autoStart });
  const workerQueue = new PQueue({ concurrency });

  if (onIdle) workerQueue.on('idle', debounce(onIdle, idleTimeout));

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
        await workerQueue.add(async () =>
          processTask({
            task,
            queue,
            client: client2,
            handler,
            stallDuration,
            getRetryDelay,
            onTaskSuccess,
            onTaskError,
            onTaskFailed,
          }),
        );
      }
      takerQueue.add(() => checkForAndHandleTask({ block: !task }));
    } catch (e) {
      if (onHandlerError) onHandlerError(e);
      console.error(e.toString());
      await sleep(1000);
      takerQueue.add(() => checkForAndHandleTask({ block: true }));
    }
  };

  if (onReady) onReady();

  takerQueue.addAll(
    map(Array.from({ length: concurrency }), () => () =>
      checkForAndHandleTask({ block: true }),
    ),
  );

  const pause = async () => {
    takerQueue.pause();
    takerQueue.clear();
    await Promise.all([workerQueue.onIdle(), takerQueue.onEmpty()]);
  };

  const resume = async () => {
    await client1.connect();
    takerQueue.start();
  };

  const quit = async () => {
    await pause();
    await Promise.all([takerQueue.clear(), workerQueue.clear()]);
    await Promise.all(
      map([client1, client2], (client) => quitClient({ client })),
    );
  };

  return {
    pause,
    resume,
    quit,
  };
};

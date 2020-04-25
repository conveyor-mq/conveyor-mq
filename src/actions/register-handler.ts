import { RedisClient } from 'redis';
import moment from 'moment';
import { map } from 'lodash';
import { Task } from '../domain/task';
import { takeTaskBlocking } from './take-task-blocking';
import { handleTask, getRetryDelayType } from './handle-task';
import { linear } from '../utils/retry-strategies';
import { sleep } from '../utils/general';
import { getStalledTasks } from './get-stalled-tasks';
import { putTask } from './put-task';
import { putTasks } from './put-tasks';

export const registerHandler = ({
  queue,
  handler,
  client,
  concurrency = 1,
  getRetryDelay = linear(),
  stallDuration = 1000,
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
  onTaskSuccess?: ({ task }: { task: Task }) => any;
  onTaskError?: ({ task }: { task: Task }) => any;
  onTaskFailed?: ({ task }: { task: Task }) => any;
  onHandlerError?: (error: any) => any;
}) => {
  const adminClient = client.duplicate();

  const reQueueStalledTasks = async () => {
    const stalledTasks = await getStalledTasks({ queue, client: adminClient });
    await putTasks({ queue, tasks: stalledTasks, client: adminClient });
    await sleep(1000);
    reQueueStalledTasks();
  };
  reQueueStalledTasks();

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
      await sleep(1000);
    } finally {
      checkForAndHandleTask(localClient);
    }
  };
  Array.from({ length: concurrency }).forEach(() => {
    checkForAndHandleTask(client.duplicate());
  });
};

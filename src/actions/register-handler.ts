import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { takeTaskBlocking } from './take-task-blocking';
import { handleTask, getRetryDelayType } from './handle-task';
import { linear } from '../utils/retry-strategies';
import { sleep } from '../utils/general';
import { getStalledTasks } from './get-stalled-tasks';
import { putStalledTasks } from './put-stalled-tasks';

export const registerHandler = ({
  queue,
  handler,
  client,
  concurrency = 1,
  getRetryDelay = linear(),
  stallDuration = 1000,
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
  const adminClient = client.duplicate();

  const reQueueStalledTasks = async () => {
    try {
      const stalledTasks = await getStalledTasks({
        queue,
        client: adminClient,
      });
      if (stalledTasks.length > 0) {
        console.log(`Re-queuing ${stalledTasks.length} stalled tasks.`);
        await putStalledTasks({
          queue,
          tasks: stalledTasks,
          client: adminClient,
        });
      }
    } catch (e) {
      console.error(e.toString());
    } finally {
      await sleep(stalledCheckInterval);
      reQueueStalledTasks();
    }
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
    } finally {
      checkForAndHandleTask(localClient);
    }
  };
  Array.from({ length: concurrency }).forEach(() => {
    checkForAndHandleTask(client.duplicate());
  });
};

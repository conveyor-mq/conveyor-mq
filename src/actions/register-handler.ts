import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { takeTaskBlocking } from './take-task-blocking';
import { handleTask, getRetryDelayType } from './handle-task';
import { linear } from '../utils/retry-strategies';
import { sleep } from '../utils';

export const registerHandler = ({
  queue,
  handler,
  client,
  concurrency = 1,
  getRetryDelay = linear(),
}: {
  queue: string;
  handler: ({ task }: { task: Task }) => any;
  client: RedisClient;
  concurrency?: number;
  getRetryDelay?: getRetryDelayType;
}) => {
  const checkForAndHandleTask = async (localClient: RedisClient) => {
    try {
      const task = await takeTaskBlocking({ queue, client });
      if (task) {
        await handleTask({
          task,
          queue,
          client: localClient,
          asOf: moment(),
          handler,
          getRetryDelay,
        });
      }
    } catch (e) {
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

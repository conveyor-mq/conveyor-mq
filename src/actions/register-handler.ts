import { RedisClient } from 'redis';
import moment from 'moment';
import { Task } from '../domain/task';
import { takeTaskBlocking } from './take-task-blocking';
import { handleTask } from './handle-task';

export const registerHandler = ({
  queue,
  handler,
  client,
  concurrency = 1,
}: {
  queue: string;
  handler: ({ task }: { task: Task }) => any;
  client: RedisClient;
  concurrency?: number;
}) => {
  const checkForAndHandleTask = async (localClient: RedisClient) => {
    const task = await takeTaskBlocking({ queue, client });
    if (task) {
      await handleTask({
        task,
        queue,
        client: localClient,
        asOf: moment(),
        handler,
      });
    }
    checkForAndHandleTask(localClient);
  };
  Array.from({ length: concurrency }).forEach(() => {
    checkForAndHandleTask(client.duplicate());
  });
};

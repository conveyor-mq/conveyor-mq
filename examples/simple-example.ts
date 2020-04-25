/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import redis from 'redis';
import { registerHandler, putTask, Task } from '../src';
import { createUuid } from '../src/utils';

const main = async () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = 'mainQueue';

  await Promise.all(
    Array.from({ length: 1000 }).map(async () => {
      const task: Task = {
        id: createUuid(),
        data: 'some-task-data',
        maxAttempts: 2,
      };
      return putTask({ queue, client, task });
    }),
  );

  registerHandler({
    queue,
    client: client.duplicate(),
    concurrency: 10,
    handler: ({ task }) => {
      console.log('Handling task: ', task.id);
      return 'some-task-result';
    },
  });
};

main();

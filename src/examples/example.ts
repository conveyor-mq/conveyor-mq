/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import redis from 'redis';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { registerHandler, putTask, Task } from '..';

const main = async () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const handlerClient = client.duplicate();
  const queue = 'mainQueue';
  registerHandler({
    queue,
    client: handlerClient,
    handler: ({ task }: { task?: Task }) => {
      console.log(task);
    },
  });
  setIntervalAsync(async () => {
    const task = { id: 'hi', data: 'yo' };
    console.log('Putting task: ', task);
    await putTask({ queue, client, task });
  }, 1000);
};

main();

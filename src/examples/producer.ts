/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import redis from 'redis';
import { myQueue } from '.';
import { putTask } from '..';

const main = async () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });

  setInterval(async () => {
    putTask({
      queue: myQueue,
      client,
      task: { id: new Date().toUTCString(), data: 'hi' },
    });
  }, 1000);
};

main();

/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import redis from 'redis';
import { myQueue } from '.';
import { takeTaskBlocking, getTaskKey, markTaskSuccess } from '..';

const main = async () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });

  const blockOnHandlingTask = async () => {
    console.log('Waiting for task...');
    const task = await takeTaskBlocking({ queue: myQueue, client });
    if (task) {
      console.log('Processing task...');
      console.log(JSON.stringify(task));
      console.log(getTaskKey({ taskId: task.id, queue: myQueue }));
      await markTaskSuccess({
        task,
        client,
        queue: myQueue,
        result: 'yaaay!',
      });
      console.log('Processed task...');
    }
    blockOnHandlingTask();
  };
  blockOnHandlingTask();
};

main();

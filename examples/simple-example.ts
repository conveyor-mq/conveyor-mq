/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import redis from 'redis';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { registerHandler, putTask, Task, getTask } from '../src';
import { createUuid } from '../src/utils';

const main = async () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const handlerClient = client.duplicate();
  const queue = 'mainQueue';

  registerHandler({
    queue,
    client: handlerClient,
    handler: ({ task }: { task?: Task }) => {
      console.log('Handling task: ', task!.id);
      return 'some-task-result';
    },
  });

  const task: Task = {
    id: createUuid(),
    data: 'some-task-data',
    maxAttempts: 2,
  };
  console.log('Putting task: ', task.id);
  await putTask({ queue, client, task });

  setTimeout(async () => {
    const completedTask = await getTask({ queue, taskId: task.id, client });
    console.log(completedTask!.id, completedTask!.status);
  }, 50);
};

main();

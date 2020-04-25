/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import redis from 'redis';
import { createUuid, sleep } from '../src/utils';
import { Task } from '../src/domain/task';
import { putTask } from '../src/actions/put-task';
import { registerHandler } from '../src/actions/register-handler';

const main = async () => {
  const client = redis.createClient({ host: '127.0.0.1', port: 9004 });
  const queue = 'mainQueue';

  registerHandler({
    queue,
    client: client.duplicate(),
    concurrency: 2,
    handler: ({ task }) => {
      console.log('Handling task: ', task.id);
      return 'some-task-result';
    },
  });

  const addTasks = async () => {
    const task: Task = {
      id: createUuid(),
      data: 'some-task-data',
    };
    await putTask({ queue, task, client });
    await sleep(Math.random() * 1000);
    addTasks();
  };
  addTasks();
};

main();

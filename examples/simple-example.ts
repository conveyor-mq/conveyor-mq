/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Task } from '../src/domain/task';
import { createUuid, sleep } from '../src/utils/general';
import { createQueueManager } from '../src/actions/create-queue-manager';

const main = async () => {
  const manager = await createQueueManager({
    queue: 'myQueue',
    redis: { host: '127.0.0.1', port: 6379 },
  });

  manager.registerHandler({
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
    await manager.putTask({ task });
    console.log('Adding task ', task.id);
    await sleep(1);
    addTasks();
  };
  addTasks();
};

main();

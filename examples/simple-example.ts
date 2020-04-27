/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Task } from '../src/domain/task';
import { createUuid, sleep } from '../src/utils/general';
import { createQueueManager } from '../src/actions/create-queue-manager';
import { createQueueHandler } from '../src/actions/create-queue-handler';
import { createQueueOrchestrator } from '../src/actions/create-queue-orchestrator';

const main = async () => {
  const redisConfig = { host: '127.0.0.1', port: 6379 };
  const queue = 'myQueue';

  const manager = await createQueueManager({
    queue,
    redisConfig,
  });
  const handler = await createQueueHandler({
    queue,
    redisConfig,
    handler: ({ task }) => {
      console.log('Handling task: ', task.id);
      return 'some-data';
    },
  });
  const orchestrator = await createQueueOrchestrator({
    queue,
    redisConfig,
  });

  const addTasks = async () => {
    const task: Task = {
      id: createUuid(),
      data: 'some-task-data',
    };
    await manager.putTask({ task });
    console.log('Adding task ', task.id);
    await sleep(1000);
    addTasks();
  };
  addTasks();
};

main();

/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createUuid, sleep } from '../src/utils/general';
import { createManager } from '../src/actions/create-manager';
import { createWorker } from '../src/actions/create-worker';
import { createOrchestrator } from '../src/actions/create-orchestrator';
import { createListener } from '../src/actions/create-listener';
import { Task } from '../src/domain/tasks/task';

const main = async () => {
  const redisConfig = { host: '127.0.0.1', port: 6379 };
  const queue = 'myQueue';

  const manager = await createManager({
    queue,
    redisConfig,
  });
  const listener = await createListener({ queue, redisConfig });

  const worker = await createWorker({
    queue,
    redisConfig,
    handler: ({ task }) => {
      console.log('Handling task: ', task.id);
      return 'some-data';
    },
  });
  const orchestrator = await createOrchestrator({
    queue,
    redisConfig,
  });

  const addTasks = async () => {
    const task: Task = {
      id: createUuid(),
      data: 'some-task-data',
    };
    await manager.enqueueTask(task);
    console.log('Adding task ', task.id);
    await sleep(1000);
    addTasks();
  };
  addTasks();
};

main();

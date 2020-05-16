/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createManager,
  createListener,
  createWorker,
  EventTypes,
  createOrchestrator,
} from 'conveyor-mq';

const main = async () => {
  const redisConfig = { host: '127.0.0.1', port: 6379 };
  const queue = 'myQueue';

  const manager = await createManager({
    queue,
    redisConfig,
  });

  const listener = await createListener({ queue, redisConfig });
  listener.on(EventTypes.TaskComplete, ({ event }) =>
    console.log('Task complete:', event?.task?.id),
  );

  const worker = await createWorker({
    queue,
    redisConfig,
    handler: () => {
      return 'some-result';
    },
  });

  const orchestrator = await createOrchestrator({
    queue,
    redisConfig,
    stalledCheckInterval: 30000,
  });

  const addTasks = async () => {
    try {
      const task = { data: 'some-task-data' };
      await manager.enqueueTask({ task });
    } catch (e) {
      console.log(e);
    }
  };
  setInterval(addTasks, 3000);
};

main();

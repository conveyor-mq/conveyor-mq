import {
  createListener,
  EventTypes,
  createWorker,
  createOrchestrator,
  createManager,
} from 'conveyor-mq';

const main = async () => {
  const redisConfig = { host: '127.0.0.1', port: 6379 };
  const queue = 'myQueue';

  const listener = await createListener({ queue, redisConfig });
  listener.on(EventTypes.TaskComplete, ({ event }) =>
    console.log('Task complete:', event?.task?.id),
  );

  const worker = await createWorker({
    queue,
    redisConfig,
    handler: async () => {
      return 'some-result';
    },
  });

  const orchestrator = await createOrchestrator({
    queue,
    redisConfig,
    stalledCheckInterval: 30000,
  });

  const manager = await createManager({
    queue,
    redisConfig,
  });
  const futureDate = new Date();
  futureDate.setSeconds(futureDate.getSeconds() + 5);
  const task = {
    data: 'some-task-data',
    enqueueAfter: futureDate,
  };
  await manager.scheduleTask({ task });
};

main();

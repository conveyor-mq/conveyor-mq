import { createWorker, createOrchestrator, createManager } from 'conveyor-mq';

const redisConfig = { host: '127.0.0.1', port: 6379 };
const queue = 'myQueue';

const worker = createWorker({
  queue,
  redisConfig,
  handler: async ({ task }) => {
    console.log('Processing task', task.id);
    return 'some-result';
  },
});

// Create an orchestrator which will enqueue scheduled tasks.
const orchestrator = createOrchestrator({
  queue,
  redisConfig,
});

const manager = createManager({
  queue,
  redisConfig,
});

const futureDate = new Date();
futureDate.setSeconds(futureDate.getSeconds() + 5);

const task = {
  data: 'some-task-data',
  enqueueAfter: futureDate,
};
console.log({ task });
manager.scheduleTask(task);

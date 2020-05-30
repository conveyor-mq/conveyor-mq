import { createWorker, createOrchestrator, createManager } from 'conveyor-mq';

const redisConfig = { host: '127.0.0.1', port: 6379 };
const queue = 'myQueue';

// Create a worker to process tasks.
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

// Create a manager.
const manager = createManager({
  queue,
  redisConfig,
});

// Create a task to be enqueued in the future.
const futureDate = new Date();
futureDate.setSeconds(futureDate.getSeconds() + 5);
const task = {
  data: 'some-task-data',
  enqueueAfter: futureDate,
};

// Schedule the task.
manager.scheduleTask(task);

import { createManager, createWorker } from 'conveyor-mq';

const queueName = 'my-queue';
const redisConfig = { host: '127.0.0.1', port: 6379 };

// Create a manager.
const manager = createManager({ queue: queueName, redisConfig });

// Enqueue a task.
manager.enqueueTask({ data: { x: 1, y: 2 } });

// Create a worker to process tasks.
const worker = createWorker({
  queue: queueName,
  redisConfig,
  handler: ({ task }) => {
    console.log(`Processing task: ${task.id}`);
    return task.data.x + task.data.y;
  },
});

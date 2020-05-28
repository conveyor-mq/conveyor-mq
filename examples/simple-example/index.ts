import { createManager, createWorker } from 'conveyor-mq';

const queueName = 'my-queue';
const redisConfig = { host: '127.0.0.1', port: 6379 };

const manager = createManager({ queue: queueName, redisConfig });
manager.enqueueTask({ data: { x: 1, y: 2 } });

const worker = createWorker({
  queue: queueName,
  redisConfig,
  handler: ({ task }) => {
    console.log(`Processing task: ${task.id}`);
    return task.data.x + task.data.y;
  },
});

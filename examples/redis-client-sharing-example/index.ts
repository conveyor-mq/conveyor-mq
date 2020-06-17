import {
  createManager,
  createWorker,
  loadLuaScripts,
  createOrchestrator,
} from 'conveyor-mq';
import RedisClient from 'ioredis';

const queueName = 'my-queue';
const redisConfig = { host: '127.0.0.1', port: 6379 };

// Create a shared Redis client.
const redisClient = new RedisClient(redisConfig.port, redisConfig.host);

// Load the custom Conveyor MQ Lua scripts on the Redis client.
const configuredRedisClient = loadLuaScripts({ client: redisClient });

// Create a manager with a shared redis client.
const manager = createManager({
  queue: queueName,
  redisConfig,
  redisClient: configuredRedisClient,
});

// Enqueue a task.
manager.enqueueTask({ data: { x: 1, y: 2 } });

// Create a worker with a shared redis client.
const worker = createWorker({
  queue: queueName,
  redisConfig,
  redisClient: configuredRedisClient,
  handler: ({ task }) => {
    console.log(`Processing task: ${task.id}`);
    return task.data.x + task.data.y;
  },
});

// Create an orchestrator with a shared redis client.
const orchestrator = createOrchestrator({
  queue: queueName,
  redisClient: configuredRedisClient,
});

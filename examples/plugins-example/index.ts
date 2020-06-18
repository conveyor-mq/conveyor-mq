import { registerPlugins, Plugin } from 'conveyor-mq';

// Create a plugin.
const myPlugin: Plugin = {
  onBeforeEnqueueTask: ({ task }) => {
    console.log(task);
  },
  onAfterEnqueueTask: ({ task }) => {
    console.log(task);
  },
};

// Register the plugin and destructure createManager and createWorker functions.
const { createManager, createWorker } = registerPlugins(myPlugin);

const queue = 'my-queue';
const redisConfig = { host: 'localhost', port: 6379 };

const manager = createManager({ queue, redisConfig });
manager.enqueueTask({ data: { x: 1, y: 2 } });

const worker = createWorker({
  queue,
  redisConfig,
  handler: ({ task }) => task.data.x + task.data.y,
});

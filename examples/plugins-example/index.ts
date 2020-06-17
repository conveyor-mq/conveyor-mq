import { registerPlugins, Plugin } from 'conveyor-mq';

const myPlugin: Plugin = {
  onBeforeEnqueueTask: ({ task }) => {
    console.log(task);
  },
  onAfterEnqueueTask: ({ task }) => {
    console.log(task);
  },
};

const { createManager, createWorker } = registerPlugins(myPlugin);

const queue = 'my-queue';
const redisConfig = { host: 'localhost', port: 6379 };

const manager = createManager({ queue, redisConfig });
manager.enqueueTask({ data: 'hi' });

const worker = createWorker({ queue, redisConfig, handler: () => 'result' });

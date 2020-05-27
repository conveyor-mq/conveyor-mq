/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createManager,
  createListener,
  createWorker,
  EventType,
  createOrchestrator,
} from 'conveyor-mq';

const redisConfig = { host: '127.0.0.1', port: 6379 };
const queue = 'myQueue';

const manager = createManager({
  queue,
  redisConfig,
});

const listener = createListener({ queue, redisConfig });
listener.on(EventType.TaskComplete, ({ event }) =>
  console.log('Task complete:', event?.task?.id),
);

const worker = createWorker({
  queue,
  redisConfig,
  handler: ({ task }) => {
    console.log('Processing task', task.id);
    return 'some-result';
  },
});

const orchestrator = createOrchestrator({
  queue,
  redisConfig,
  stalledCheckInterval: 30000,
});

const addTasks = () => {
  try {
    const task = { data: 'some-task-data' };
    manager.enqueueTask(task);
  } catch (e) {
    console.log(e);
  }
};
setInterval(addTasks, 1000);

/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { createUuid } from '../src/utils/general';
import { createManager } from '../src/actions/create-manager';
import { createWorker } from '../src/actions/create-worker';
import { createOrchestrator } from '../src/actions/create-orchestrator';
import { createListener } from '../src/actions/create-listener';
import { Task } from '../src/domain/tasks/task';
import { EventTypes } from '../src/domain/events/event-types';

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
    handler: async () => {
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
      const task: Task = { id: createUuid(), data: 'some-task-data' };
      await manager.enqueueTask({ task });
    } catch (e) {
      console.log(e);
    }
  };
  setIntervalAsync(addTasks, 3000);
};

main();

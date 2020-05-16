/* eslint-disable no-restricted-globals */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import moment from 'moment';
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
  const task = {
    data: 'some-task-data',
    enqueueAfter: moment().add(3, 'seconds'),
  };
  await manager.enqueueTask({ task });
};

main();

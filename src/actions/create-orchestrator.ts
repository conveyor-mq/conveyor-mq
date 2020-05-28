import {
  setIntervalAsync,
  clearIntervalAsync,
} from 'set-interval-async/dynamic';
import debugF from 'debug';
import { map } from 'lodash';
import { processStalledTasks as processStalledTasksAction } from './process-stalled-tasks';
import { enqueueScheduledTasks as enqueueScheduledTasksAction } from './enqueue-scheduled-tasks';
import {
  quit as redisQuit,
  createClientAndLoadLuaScripts,
} from '../utils/redis';
import { RedisConfig } from '../utils/general';
import { acknowledgeOrphanedProcessingTasks } from './acknowledge-orphaned-processing-tasks';

const debug = debugF('conveyor-mq:orchestrator');

export const createOrchestrator = ({
  queue,
  redisConfig,
  stalledCheckInterval = 1000,
  delayedTasksCheckInterval = 1000,
  defaultStallTimeout = 1000,
}: {
  queue: string;
  redisConfig: RedisConfig;
  stalledCheckInterval?: number;
  delayedTasksCheckInterval?: number;
  defaultStallTimeout?: number;
}) => {
  debug('Starting');
  debug('Creating client');
  const client = createClientAndLoadLuaScripts(redisConfig);

  const processStalledTasks = async () => {
    try {
      await acknowledgeOrphanedProcessingTasks({
        queue,
        defaultStallTimeout,
        client,
      });
      debug('acknowledgeOrphanedProcessingTasks');
      await processStalledTasksAction({ queue, client });
      debug('processStalledTasks');
    } catch (e) {
      console.error(e.toString());
    }
  };
  const stalledTimer = setIntervalAsync(
    processStalledTasks,
    stalledCheckInterval,
  );

  const enqueueScheduledTasks = async () => {
    try {
      await enqueueScheduledTasksAction({ queue, client });
      debug('enqueueScheduledTasks');
    } catch (e) {
      console.error(e.toString());
    }
  };
  const enqueueDelayedTasksTimer = setIntervalAsync(
    enqueueScheduledTasks,
    delayedTasksCheckInterval,
  );

  const quit = async () => {
    debug('quit');
    await Promise.all([
      redisQuit({ client }),
      map([stalledTimer, enqueueDelayedTasksTimer], (timer) =>
        clearIntervalAsync(timer),
      ),
    ]);
  };

  const ready = async () => {
    debug('Ready');
  };
  const readyPromise = ready();

  return {
    onReady: async () => {
      debug('onReady');
      await readyPromise;
    },
    quit,
  };
};

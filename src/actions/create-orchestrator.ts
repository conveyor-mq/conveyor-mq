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

/**
 * Creates an orchestrator which is responsible for monitoring the queue
 * for stalled tasks and re-enqueuing them if needed, as well as enqueuing
 * scheduled tasks.
 *
 * @param queue - The name of the queue.
 * @param redisConfig - Redis configuration.
 * @param stalledCheckInterval - The frequency at which stalled tasks should be checked at.
 * @param scheduledTasksCheckInterval - The frequency at which scheduled tasks should be checked at.
 * @param defaultStallTimeout - The default stall timeout to use for orphaned processing tasks.
 * @returns orchestrator
 * - .onReady(): Promise<void> - Returns a promise that resolves when the orchestrator is ready.
 * - .quit(): Promise<void> - Quits the orchestrator, terminating all intervals and the redis client.
 */
export const createOrchestrator = ({
  queue,
  redisConfig,
  stalledCheckInterval = 1000,
  scheduledTasksCheckInterval = 1000,
  defaultStallTimeout = 1000,
}: {
  queue: string;
  redisConfig: RedisConfig;
  stalledCheckInterval?: number;
  scheduledTasksCheckInterval?: number;
  defaultStallTimeout?: number;
}) => {
  debug('Starting');
  debug('Creating client');
  const client = createClientAndLoadLuaScripts(redisConfig);

  const processStalledTasks = async () => {
    try {
      debug('acknowledgeOrphanedProcessingTasks');
      await acknowledgeOrphanedProcessingTasks({
        queue,
        defaultStallTimeout,
        client,
      });
      debug('processStalledTasks');
      await processStalledTasksAction({ queue, client });
    } catch (e) {
      console.error(e.toString());
    }
  };
  const stalledTimer = setIntervalAsync(
    processStalledTasks,
    stalledCheckInterval,
  );

  const enqueueScheduledTasks = async () => {
    debug('enqueueScheduledTasks');
    try {
      await enqueueScheduledTasksAction({ queue, client });
    } catch (e) {
      console.error(e.toString());
    }
  };
  const enqueueDelayedTasksTimer = setIntervalAsync(
    enqueueScheduledTasks,
    scheduledTasksCheckInterval,
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

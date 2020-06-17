import {
  setIntervalAsync,
  clearIntervalAsync,
} from 'set-interval-async/dynamic';
import debugF from 'debug';
import { map } from 'lodash';
import { Redis } from 'ioredis';
import { processStalledTasks } from './process-stalled-tasks';
import { enqueueScheduledTasks } from './enqueue-scheduled-tasks';
import {
  quit as redisQuit,
  createClientAndLoadLuaScripts,
} from '../utils/redis';
import { RedisConfig } from '../utils/general';
import { acknowledgeOrphanedProcessingTasks } from './acknowledge-orphaned-processing-tasks';
import { Orchestrator } from '../domain/orchestrator/orchestrator';

const debug = debugF('conveyor-mq:orchestrator');

/**
 * Creates an orchestrator which is responsible for monitoring the queue
 * for stalled tasks and re-enqueuing them if needed, as well as enqueuing
 * scheduled tasks.
 *
 * @param queue - The name of the queue.
 * @param redisConfig - Redis configuration.
 * @param redisClient - An optional Redis client for the orchestrator to re-use. The client
 * must have lua scripts loaded which can be done by calling loadLuaScripts({ client }).
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
  redisClient,
  stalledCheckInterval = 1000,
  scheduledTasksCheckInterval = 1000,
  defaultStallTimeout = 1000,
}: {
  queue: string;
  redisConfig?: RedisConfig;
  redisClient?: Redis;
  stalledCheckInterval?: number;
  scheduledTasksCheckInterval?: number;
  defaultStallTimeout?: number;
}): Orchestrator => {
  debug('Starting');
  if (!redisClient && !redisConfig) {
    throw new Error('redisClient or redisConfig must be provided');
  }
  debug('Creating client');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = redisClient || createClientAndLoadLuaScripts(redisConfig!);

  const processStalledTasksTick = async () => {
    try {
      debug('acknowledgeOrphanedProcessingTasks');
      await acknowledgeOrphanedProcessingTasks({
        queue,
        defaultStallTimeout,
        client,
      });
      debug('processStalledTasks');
      await processStalledTasks({ queue, client });
    } catch (e) {
      console.error(e.toString());
    }
  };
  const stalledTimer = setIntervalAsync(
    processStalledTasksTick,
    stalledCheckInterval,
  );

  const enqueueScheduledTasksTick = async () => {
    debug('enqueueScheduledTasks');
    try {
      await enqueueScheduledTasks({ queue, client });
    } catch (e) {
      console.error(e.toString());
    }
  };
  const enqueueDelayedTasksTimer = setIntervalAsync(
    enqueueScheduledTasksTick,
    scheduledTasksCheckInterval,
  );

  const quit = async () => {
    debug('quit');
    await Promise.all(
      map([stalledTimer, enqueueDelayedTasksTimer], (timer) =>
        clearIntervalAsync(timer),
      ),
    );
    if (!redisClient) {
      await redisQuit({ client });
    }
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

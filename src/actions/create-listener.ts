import debugF from 'debug';
import { deSerializeEvent } from '../domain/events/deserialize-event';
import { Event } from '../domain/events/event';
import { EventType } from '../domain/events/event-type';
import { Listener } from '../domain/listener/listener';
import { pickBy } from '../utils/general';
import {
  getQueueRateLimitUpdatedChannel,
  getQueueTaskCompleteChannel,
  getQueueTaskErrorChannel,
  getQueueTaskFailedChannel,
  getQueueTaskProcessingChannel,
  getQueueTaskProgressUpdatedChannel,
  getQueueTaskQueuedChannel,
  getQueueTaskScheduledChannel,
  getQueueTaskStalledChannel,
  getQueueTaskSuccessChannel,
  getQueueTaskUpdatedChannel,
  getWorkerPausedChannel,
  getWorkerShutdownChannel,
  getWorkerStartedChannel,
} from '../utils/keys';
import {
  createClientAndLoadLuaScripts,
  ensureDisconnected,
  RedisConfig,
} from '../utils/redis';

const debug = debugF('conveyor-mq:listener');

/**
 * Creates a listener which listens for various task, queue and worker related events.
 *
 * @param queue - The name of the queue.
 * @param redisConfig - Redis configuration.
 * @param events - An optional list of events which should be listened for. Defaults to all events.
 * @returns listener
 * - .onReady(): Promise<void> - A function which returns a promise that resolves when the listener is ready.
 * - .on(eventName, handler): void - A function which registers a handler function for a particular event.
 * - .quit(): Promise<void> - Quits the listener, disconnects the redis client and removes all handlers.
 */
export const createListener = ({
  queue,
  redisConfig,
  events,
}: {
  queue: string;
  redisConfig: RedisConfig;
  events?: EventType[];
}): Listener => {
  debug('Starting');
  debug('Creating client');
  const client = createClientAndLoadLuaScripts(redisConfig);

  const handlers: {
    [key: string]: (({ event }: { event: Event }) => any)[];
  } = {};

  const setupListener = async () => {
    const channelMap: { [key in EventType]: string } = {
      [EventType.TaskScheduled]: getQueueTaskScheduledChannel({ queue }),
      [EventType.TaskQueued]: getQueueTaskQueuedChannel({ queue }),
      [EventType.TaskProcessing]: getQueueTaskProcessingChannel({ queue }),
      [EventType.TaskSuccess]: getQueueTaskSuccessChannel({ queue }),
      [EventType.TaskError]: getQueueTaskErrorChannel({ queue }),
      [EventType.TaskStalled]: getQueueTaskStalledChannel({ queue }),
      [EventType.TaskFail]: getQueueTaskFailedChannel({ queue }),
      [EventType.TaskComplete]: getQueueTaskCompleteChannel({ queue }),
      [EventType.TaskUpdated]: getQueueTaskUpdatedChannel({ queue }),
      [EventType.TaskProgressUpdated]: getQueueTaskProgressUpdatedChannel({
        queue,
      }),
      [EventType.WorkerStarted]: getWorkerStartedChannel({ queue }),
      [EventType.WorkerPaused]: getWorkerPausedChannel({ queue }),
      [EventType.WorkerShutdown]: getWorkerShutdownChannel({ queue }),
      [EventType.QueueRateLimitUpdated]: getQueueRateLimitUpdatedChannel({
        queue,
      }),
    };
    client.on('message', (channel, eventString) => {
      const event = deSerializeEvent(eventString);
      const handlersToCall = handlers[event.type];
      debug(`Received message ${eventString} on channel ${channel}`);
      (handlersToCall || []).forEach((handler) => handler({ event }));
    });
    debug('Registered message handler');
    const channels = Object.values(
      events
        ? pickBy(channelMap, (channel, eventType) =>
            events.includes(eventType as EventType),
          )
        : channelMap,
    );
    await client.subscribe(channels);
    debug('Client subscribed to channels');
  };
  const setupPromise = setupListener();

  const ready = async () => {
    await Promise.all([setupPromise]);
    debug('Ready');
  };
  const readyPromise = ready();

  return {
    onReady: async () => {
      await readyPromise;
    },
    on: (eventType: EventType, f: ({ event }: { event: Event }) => any) => {
      handlers[eventType] = [...(handlers[eventType] || []), f];
    },
    quit: async () => {
      await readyPromise;
      await ensureDisconnected({ client });
    },
  };
};

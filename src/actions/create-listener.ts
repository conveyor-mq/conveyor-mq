import { forEach, pickBy } from 'lodash';
import debugF from 'debug';
import { RedisConfig } from '../utils/general';
import { createClient } from '../utils/redis';
import {
  getQueueTaskQueuedChannel,
  getQueueTaskProcessingChannel,
  getQueueTaskSuccessChannel,
  getQueueTaskErrorChannel,
  getQueueTaskStalledChannel,
  getQueueTaskFailedChannel,
  getQueueTaskCompleteChannel,
  getQueueTaskUpdatedChannel,
  getWorkerStartedChannel,
  getWorkerPausedChannel,
  getWorkerShutdownChannel,
  getQueueTaskScheduledChannel,
  getQueueTaskProgressUpdatedChannel,
} from '../utils/keys';
import { deSerializeEvent } from '../domain/events/deserialize-event';
import { Event } from '../domain/events/event';
import { EventType } from '../domain/events/event-type';

const debug = debugF('conveyor-mq:listener');

export const createListener = ({
  queue,
  redisConfig,
  events,
}: {
  queue: string;
  redisConfig: RedisConfig;
  events?: EventType[];
}) => {
  debug('Starting');
  debug('Creating client');
  const clientPromise = createClient(redisConfig);

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
    };
    const client = await clientPromise;
    client.on('message', (channel, eventString) => {
      const event = deSerializeEvent(eventString);
      const handlersToCall = handlers[event.type];
      debug(`Received message ${eventString} on channel ${channel}`);
      forEach(handlersToCall, (handler) => handler({ event }));
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
    await Promise.all([setupPromise, clientPromise]);
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
  };
};

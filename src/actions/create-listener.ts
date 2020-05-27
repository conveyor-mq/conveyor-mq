import { forEach } from 'lodash';
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

export const createListener = ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
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
      forEach(handlersToCall, (handler) => handler({ event }));
    });
    const channels = Object.values(channelMap);
    await client.subscribe(channels);
  };
  const setupPromise = setupListener();

  return {
    onReady: async () => {
      await Promise.all([setupPromise, clientPromise]);
    },
    on: (eventType: EventType, f: ({ event }: { event: Event }) => any) => {
      handlers[eventType] = [...(handlers[eventType] || []), f];
    },
  };
};

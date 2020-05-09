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
} from '../utils/keys';
import { deSerializeEvent } from '../domain/events/deserialize-event';
import { Event } from '../domain/events/event';
import { EventTypes } from '../domain/events/event-types';

export const createListener = async ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  const client = await createClient(redisConfig);
  const handlers: {
    [key: string]: (({ event }: { event: Event }) => any)[];
  } = {};
  const channels = [
    getQueueTaskQueuedChannel({ queue }),
    getQueueTaskProcessingChannel({ queue }),
    getQueueTaskSuccessChannel({ queue }),
    getQueueTaskErrorChannel({ queue }),
    getQueueTaskStalledChannel({ queue }),
    getQueueTaskFailedChannel({ queue }),
    getQueueTaskCompleteChannel({ queue }),
    getQueueTaskUpdatedChannel({ queue }),
  ];
  client.on('message', (channel, eventString) => {
    const event = deSerializeEvent(eventString);
    const handlersToCall = handlers[event.type];
    forEach(handlersToCall, (handler) => handler({ event }));
  });
  await client.subscribe(channels);
  return {
    on: (eventType: EventTypes, f: ({ event }: { event: Event }) => any) => {
      handlers[eventType] = [...(handlers[eventType] || []), f];
    },
  };
};

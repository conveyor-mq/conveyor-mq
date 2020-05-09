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
} from '../utils/keys';
import { deSerializeEvent } from '../domain/events/deserialize-event';
import { Event } from '../domain/events/event';

export const createListener = async ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  const client = await createClient(redisConfig);
  const channels = [
    getQueueTaskQueuedChannel({ queue }),
    getQueueTaskProcessingChannel({ queue }),
    getQueueTaskSuccessChannel({ queue }),
    getQueueTaskErrorChannel({ queue }),
    getQueueTaskStalledChannel({ queue }),
    getQueueTaskFailedChannel({ queue }),
    getQueueTaskCompleteChannel({ queue }),
  ];
  client.on('message', (channel, eventString) => {
    const event = deSerializeEvent(eventString);
  });
  await client.subscribe(channels);
  return {
    on: (f: (event: Event) => any) => f,
  };
};

import { RedisConfig } from '../utils/general';
import { createClient } from '../utils/redis';
import { getTaskQueuedChannel, getTaskProcessingChannel } from '../utils/keys';
import { deSerializeTask } from '../domain/deserialize-task';
import { Task } from '../domain/task';

export const createQueueListener = ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  return {
    onTaskQueued: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getTaskQueuedChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskProcessing: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getTaskProcessingChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
  };
};

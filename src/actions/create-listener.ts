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
import { deSerializeTask } from '../domain/deserialize-task';
import { Task } from '../domain/task';

export const createListener = ({
  queue,
  redisConfig,
}: {
  queue: string;
  redisConfig: RedisConfig;
}) => {
  return {
    onTaskQueued: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskQueuedChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskProcessing: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskProcessingChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskSuccess: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskSuccessChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskError: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskErrorChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskStalled: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskStalledChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskFailed: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskFailedChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
    onTaskComplete: async (cb: (task?: Task) => any) => {
      const client = await createClient(redisConfig);
      client.subscribe(getQueueTaskCompleteChannel({ queue }));
      client.on('message', (channel, taskString) => {
        const task = deSerializeTask(taskString);
        cb(task);
      });
    },
  };
};

import { Redis } from 'ioredis';
import { callLuaScript } from '../utils/redis';
import {
  getProcessingListKey,
  getStallingHashKey,
  getTaskKey,
} from '../utils/keys';

/**
 * @ignore
 */
export const acknowledgeOrphanedProcessingTasks = async ({
  queue,
  defaultStallTimeout = 1000,
  client,
}: {
  queue: string;
  defaultStallTimeout?: number;
  client: Redis;
}) => {
  const acknowledgedTaskIds = (await callLuaScript({
    client,
    script: 'acknowledgeOrphanedProcessingTasks',
    args: [
      getProcessingListKey({ queue }),
      getStallingHashKey({ queue }),
      getTaskKey({ taskId: '', queue }),
      queue,
      defaultStallTimeout,
    ],
  })) as string[];
  return acknowledgedTaskIds;
};

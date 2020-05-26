import { Redis } from 'ioredis';
import { callLuaScript } from '../utils/redis';
import {
  getProcessingListKey,
  getStallingHashKey,
  getTaskKeyPrefix,
} from '../utils/keys';
import { LuaScriptName } from '../lua';

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
    script: LuaScriptName.acknowledgeOrphanedProcessingTasks,
    args: [
      getProcessingListKey({ queue }),
      getStallingHashKey({ queue }),
      getTaskKeyPrefix({ queue }),
      queue,
      defaultStallTimeout,
    ],
  })) as string[];
  return acknowledgedTaskIds;
};

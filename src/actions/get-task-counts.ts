import { Redis } from 'ioredis';
import {
  getProcessingListKey,
  getQueuedListKey,
  getScheduledSetKey,
  getSuccessListKey,
  getFailedListKey,
} from '../utils/keys';
import { exec } from '../utils/redis';

/**
 * @ignore
 */
export const getTaskCounts = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const multi = client.multi();
  multi.zcard(getScheduledSetKey({ queue }));
  multi.llen(getQueuedListKey({ queue }));
  multi.llen(getProcessingListKey({ queue }));
  multi.llen(getSuccessListKey({ queue }));
  multi.llen(getFailedListKey({ queue }));
  const [
    scheduledCount,
    queuedCount,
    processingCount,
    successCount,
    failedCount,
  ] = (await exec(multi)) as number[];
  return {
    scheduledCount,
    queuedCount,
    processingCount,
    successCount,
    failedCount,
  };
};

import { Redis } from 'ioredis';
import {
  getQueuedListKey,
  getProcessingListKey,
  getSuccessListKey,
  getFailedListKey,
  getStallingHashKey,
  getScheduledSetKey,
  getTaskKey,
} from '../utils/keys';
import { exec } from '../utils/redis';

/**
 * @ignore
 */
export const removeTaskById = async ({
  taskId,
  queue,
  client,
}: {
  taskId: string;
  queue: string;
  client: Redis;
}) => {
  const multi = client.multi();
  multi.del(getTaskKey({ taskId, queue }));
  multi.zrem(getScheduledSetKey({ queue }), taskId);
  multi.lrem(getQueuedListKey({ queue }), 1, taskId);
  multi.lrem(getProcessingListKey({ queue }), 1, taskId);
  multi.hdel(getStallingHashKey({ queue }), taskId);
  multi.lrem(getSuccessListKey({ queue }), 1, taskId);
  multi.lrem(getFailedListKey({ queue }), 1, taskId);
  await exec(multi);
};

import { Redis } from 'ioredis';
import { hkeys } from '../utils/redis';
import { getStallingHashKey } from '../utils/keys';

export const getStallingTaskIds = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const stallingTasksIds = await hkeys({
    key: getStallingHashKey({ queue }),
    client,
  });
  return stallingTasksIds;
};

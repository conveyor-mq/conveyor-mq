import { RedisClient } from 'redis';
import { getQueuedListKey } from './tasks';
import { rpop, brpop, lpush } from './utils';

export const put = async ({
  queue,
  client,
  elements,
}: {
  queue: string;
  client: RedisClient;
  elements: string[];
}): Promise<string[]> => {
  await lpush({
    key: getQueuedListKey({ queue }),
    elements,
    client,
  });
  return elements;
};

export const take = async ({
  queue,
  client,
}: {
  queue: string;
  client: RedisClient;
}): Promise<string | null> => {
  const result = await rpop({
    key: getQueuedListKey({ queue }),
    client,
  });
  return result;
};

export const blockTake = async ({
  queue,
  client,
}: {
  queue: string;
  client: RedisClient;
}): Promise<string | null> => {
  const result = await brpop({
    key: getQueuedListKey({ queue }),
    client,
  });
  return result[1];
};

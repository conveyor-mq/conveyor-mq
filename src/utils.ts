import { v4 as uuid } from 'uuid';
import { RedisClient } from 'redis';

export const asyncForEach = async (
  array: any[],
  callback: (...args: any) => any,
) => {
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < array.length; index++) {
    // eslint-disable-next-line no-await-in-loop
    await callback(array[index], index, array);
  }
};

export const createUuid = () => {
  return uuid();
};

export const sleep = async (n: number) => {
  await new Promise(r => setTimeout(r, n));
};

export const get = ({
  client,
  key,
}: {
  client: RedisClient;
  key: string;
}): Promise<string | null> =>
  new Promise(resolve => {
    client.get(key, (err, result) => resolve(result));
  });

export const set = ({
  key,
  value,
  client,
}: {
  key: string;
  value: string;
  client: RedisClient;
}) =>
  new Promise(resolve => {
    client.set(key, value, (err, result) => resolve(result));
  });

export const lpush = ({
  key,
  elements,
  client,
}: {
  key: string;
  elements: string[];
  client: RedisClient;
}) =>
  new Promise(resolve => {
    client.lpush(key, ...elements, (err, result) => resolve(result));
  });

export const rpop = ({
  key,
  client,
}: {
  key: string;
  client: RedisClient;
}): Promise<string | null> =>
  new Promise(resolve => {
    client.rpop(key, (err, result) => resolve(result));
  });

export const rpoplpush = ({
  fromKey,
  toKey,
  client,
}: {
  fromKey: string;
  toKey: string;
  client: RedisClient;
}): Promise<string | null> =>
  new Promise(resolve => {
    client.rpoplpush(fromKey, toKey, (err, result) => resolve(result));
  });

export const brpop = ({
  key,
  timeout,
  client,
}: {
  key: string;
  timeout?: number;
  client: RedisClient;
}): Promise<string[] | null[]> =>
  new Promise((resolve, reject) => {
    client.brpop(key, timeout || 0, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

export const brpoplpush = ({
  fromKey,
  toKey,
  timeout = 0,
  client,
}: {
  fromKey: string;
  toKey: string;
  timeout?: number;
  client: RedisClient;
}): Promise<string | null> =>
  new Promise(resolve => {
    client.brpoplpush(fromKey, toKey, timeout, (err, result) =>
      resolve(result),
    );
  });

export const flushAll = ({ client }: { client: RedisClient }) =>
  new Promise((resolve, reject) => {
    client.flushall((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

export const getTaskKey = ({
  taskId,
  queue,
}: {
  taskId: string;
  queue: string;
}) => {
  return `${queue}:tasks:${taskId}`;
};

export const getQueuedListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:queued`;

export const getProcessingListKey = ({ queue }: { queue: string }) =>
  `${queue}:lists:processing`;

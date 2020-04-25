import { RedisClient } from 'redis';

export const get = ({
  client,
  key,
}: {
  client: RedisClient;
  key: string;
}): Promise<string | null> =>
  new Promise((resolve, reject) => {
    client.get(key, (err, result) => (err ? reject(err) : resolve(result)));
  });

export const set = ({
  key,
  value,
  client,
  ttl,
}: {
  key: string;
  value: string;
  client: RedisClient;
  ttl?: number;
}) =>
  new Promise((resolve, reject) => {
    if (ttl) {
      client.set(key, value, 'px', ttl, (err, result) =>
        err ? reject(err) : resolve(result),
      );
    } else {
      client.set(key, value, (err, result) =>
        err ? reject(err) : resolve(result),
      );
    }
  });

export const exists = ({ key, client }: { key: string; client: RedisClient }) =>
  new Promise((resolve, reject) => {
    client.exists(key, (err, result) => (err ? reject(err) : resolve(result)));
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
  new Promise((resolve, reject) => {
    client.lpush(key, ...elements, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });

export const rpop = ({
  key,
  client,
}: {
  key: string;
  client: RedisClient;
}): Promise<string | null> =>
  new Promise((resolve, reject) => {
    client.rpop(key, (err, result) => (err ? reject(err) : resolve(result)));
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
  new Promise((resolve, reject) => {
    client.rpoplpush(fromKey, toKey, (err, result) =>
      err ? reject(err) : resolve(result),
    );
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
    client.brpop(key, timeout || 0, (err, result) =>
      err ? reject(err) : resolve(result),
    );
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
  new Promise((resolve, reject) => {
    client.brpoplpush(fromKey, toKey, timeout, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });

export const flushAll = ({ client }: { client: RedisClient }) =>
  new Promise((resolve, reject) => {
    client.flushall((err, result) => (err ? reject(err) : resolve(result)));
  });

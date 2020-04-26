import RedisClient, { Redis } from 'ioredis';
import { loadScripts } from '../scripts';

export const createClient = (config: { host: string; port: number }) => {
  const client = new RedisClient(config);
  return loadScripts({ client });
};

export const get = ({
  client,
  key,
}: {
  client: Redis;
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
  client: Redis;
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

export const exists = ({
  key,
  client,
}: {
  key: string;
  client: Redis;
}): Promise<number> =>
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
  client: Redis;
}) => client.lpush(key, ...elements);

export const rpop = ({
  key,
  client,
}: {
  key: string;
  client: Redis;
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
  client: Redis;
}): Promise<string | null> =>
  new Promise((resolve, reject) => {
    client.rpoplpush(fromKey, toKey, (err, result) =>
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
  client: Redis;
}): Promise<string | null> =>
  new Promise((resolve, reject) => {
    client.brpoplpush(fromKey, toKey, timeout, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });

export const flushAll = ({ client }: { client: Redis }) =>
  new Promise((resolve, reject) => {
    client.flushall((err, result) => (err ? reject(err) : resolve(result)));
  });

export const quit = ({ client }: { client: Redis }) =>
  new Promise((resolve, reject) => {
    client.quit((err, result) => (err ? reject(err) : resolve(result)));
  });

export const lrange = ({
  start,
  stop,
  key,
  client,
}: {
  start: number;
  stop: number;
  key: string;
  client: Redis;
}): Promise<string[]> =>
  new Promise((resolve, reject) => {
    client.lrange(key, start, stop, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });

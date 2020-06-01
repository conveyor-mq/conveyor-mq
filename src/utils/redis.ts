import RedisClient, { Redis, Pipeline } from 'ioredis';
import { map } from 'lodash';
import { loadLuaScripts, LuaScriptName } from '../lua';

export const createClientAndLoadLuaScripts = ({
  host,
  port,
  lazyConnect,
  enableReadyCheck,
}: {
  host: string;
  port: number;
  lazyConnect?: boolean;
  enableReadyCheck?: boolean;
}) => {
  const client = new RedisClient({
    host,
    port,
    lazyConnect,
    maxRetriesPerRequest: null,
    enableReadyCheck,
  });
  const updatedClient = loadLuaScripts({ client });
  return updatedClient;
};

export const callLuaScriptMulti = ({
  script,
  args,
  multi,
}: {
  script: LuaScriptName;
  args: (string | number)[];
  multi: Pipeline;
}) => {
  (multi as any)[script](...args);
};

export const callLuaScript = ({
  script,
  args,
  client,
}: {
  script: LuaScriptName;
  args: (string | number)[];
  client: Redis;
}) => {
  return (client as any)[script](...args) as Promise<string | string[]>;
};

export const publish = ({
  channel,
  message,
  client,
}: {
  channel: string;
  message: string;
  client: Redis;
}) => {
  return new Promise((resolve, reject) => {
    client.publish(channel, message, (err, res) =>
      err ? reject(err) : resolve(res),
    );
  });
};

export const ensureConnected = async ({ client }: { client: Redis }) => {
  try {
    await client.connect();
  } catch (e) {
    if (e.message !== 'Redis is already connecting/connected') {
      throw e;
    }
  }
};

export const tryIgnore = async <T>(
  f: () => T,
  shouldThrow: (e: Error) => boolean,
  // eslint-disable-next-line consistent-return
) => {
  try {
    return await f();
  } catch (e) {
    if (shouldThrow(e)) {
      throw e;
    }
  }
};

export const ensureDisconnected = ({ client }: { client: Redis }) => {
  return client.status === 'end'
    ? Promise.resolve()
    : new Promise((resolve) => {
        client.disconnect();
        client.on('end', () => resolve());
      });
};

export const exec = (multi_: Pipeline) => {
  return new Promise((resolve, reject) => {
    multi_.exec((err, results) =>
      err ? reject(err) : resolve(map(results, (result) => result[1])),
    );
  }) as Promise<(string | number)[]>;
};

export const rpoplpush = ({
  client,
  fromKey,
  toKey,
}: {
  client: Redis;
  fromKey: string;
  toKey: string;
}) => {
  return new Promise((resolve, reject) => {
    client.rpoplpush(fromKey, toKey, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });
};

export const zrangebyscore = ({
  client,
  key,
  min,
  max,
}: {
  client: Redis;
  key: string;
  min: string | number;
  max: string | number;
}) => {
  return client.zrangebyscore(key, min, max);
};

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

export const hkeys = ({
  client,
  key,
}: {
  client: Redis;
  key: string;
}): Promise<string[]> =>
  new Promise((resolve, reject) => {
    client.hkeys(key, (err, result) => (err ? reject(err) : resolve(result)));
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

export const keys = ({
  pattern,
  client,
}: {
  pattern: string;
  client: Redis;
}): Promise<string[]> =>
  new Promise((resolve, reject) => {
    client.keys(pattern, (err, result) =>
      err ? reject(err) : resolve(result),
    );
  });

export const mget = ({
  keys: mgetKeys,
  client,
}: {
  keys: string[];
  client: Redis;
}) => client.mget(...mgetKeys);

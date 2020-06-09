import { Redis } from 'ioredis';
import { filter, map } from 'lodash';
import { keys, mget } from '../utils/redis';
import { getWorkerKeyPrefix } from '../utils/keys';
import { deSerializeWorker } from '../domain/worker/deserialize-worker';

/**
 * @ignore
 */
export const getWorkers = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const workerKeys = await keys({
    pattern: `${getWorkerKeyPrefix({ queue })}*`,
    client,
  });
  const results =
    workerKeys.length > 0 ? await mget({ keys: workerKeys, client }) : [];
  const nonNullResults = filter(results, (result) => !!result) as string[];
  const workers = map(nonNullResults, (workerString) =>
    deSerializeWorker(workerString),
  );
  return workers;
};

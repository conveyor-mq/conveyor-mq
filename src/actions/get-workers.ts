import { Redis } from 'ioredis';
import { deSerializeWorker } from '../domain/worker/deserialize-worker';
import { getWorkerKeyPrefix } from '../utils/keys';
import { keys, mget } from '../utils/redis';

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
  const nonNullResults = results.filter((result) => !!result) as string[];
  const workers = nonNullResults.map((workerString) =>
    deSerializeWorker(workerString),
  );
  return workers;
};

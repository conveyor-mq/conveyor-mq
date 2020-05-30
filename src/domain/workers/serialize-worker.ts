import { workerToJson } from './worker-to-json';
import { Worker } from './worker';

/**
 * @ignore
 */
export const serializeWorker = (worker: Worker) => {
  return JSON.stringify(workerToJson(worker));
};

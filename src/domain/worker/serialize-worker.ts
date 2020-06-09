import { workerToJson } from './worker-to-json';
import { WorkerInstance } from './worker-instance';

/**
 * @ignore
 */
export const serializeWorker = (worker: WorkerInstance) => {
  return JSON.stringify(workerToJson(worker));
};

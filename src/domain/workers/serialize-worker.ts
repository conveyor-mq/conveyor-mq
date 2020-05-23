import { workerToJson } from './worker-to-json';
import { Worker } from './worker';

export const serializeWorker = (worker: Worker) => {
  return JSON.stringify(workerToJson(worker));
};

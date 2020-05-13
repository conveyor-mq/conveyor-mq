import { Worker } from './worker';

/**
 * @ignore
 */
export const workerToJson = (worker: Worker) => {
  return {
    id: worker.id,
    createdAt: worker.createdAt.toISOString(),
  };
};

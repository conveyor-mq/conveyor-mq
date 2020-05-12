import { Worker } from './worker';

export const workerToJson = (worker: Worker) => {
  return {
    id: worker.id,
    createdAt: worker.createdAt.toISOString(),
  };
};

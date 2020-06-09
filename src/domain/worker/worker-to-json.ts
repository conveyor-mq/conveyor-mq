import { WorkerInstance } from './worker-instance';

/**
 * @ignore
 */
export const workerToJson = (worker: WorkerInstance) => {
  return {
    id: worker.id,
    createdAt: worker.createdAt.toISOString(),
  };
};

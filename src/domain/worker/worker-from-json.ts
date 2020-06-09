import { WorkerInstance } from './worker-instance';

/**
 * @ignore
 */
export const workerFromJson = (workerJson: any): WorkerInstance => {
  return {
    id: workerJson.id,
    createdAt: new Date(workerJson.createdAt),
  };
};

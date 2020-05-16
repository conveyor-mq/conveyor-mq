import { Worker } from './worker';

/**
 * @ignore
 */
export const workerFromJson = (workerJson: any): Worker => {
  return {
    id: workerJson.id,
    createdAt: new Date(workerJson.createdAt),
  };
};

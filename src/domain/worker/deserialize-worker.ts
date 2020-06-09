import { workerFromJson } from './worker-from-json';

/**
 * @ignore
 */
export const deSerializeWorker = (workerString: string) => {
  return workerFromJson(JSON.parse(workerString));
};

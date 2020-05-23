import { workerFromJson } from './worker-from-json';

export const deSerializeWorker = (workerString: string) => {
  return workerFromJson(JSON.parse(workerString));
};

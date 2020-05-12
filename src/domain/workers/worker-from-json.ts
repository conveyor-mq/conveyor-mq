import moment from 'moment';
import { Worker } from './worker';

export const workerFromJson = (workerJson: any): Worker => {
  return {
    id: workerJson.id,
    createdAt: moment(workerJson.createdAt),
  };
};

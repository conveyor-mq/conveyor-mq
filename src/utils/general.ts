import { v4 as uuid } from 'uuid';

export const asyncForEach = async (
  array: any[],
  callback: (...args: any) => any,
) => {
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < array.length; index++) {
    // eslint-disable-next-line no-await-in-loop
    await callback(array[index], index, array);
  }
};

export const createUuid = () => {
  return uuid();
};

export const sleep = async (n: number) => {
  await new Promise(r => setTimeout(r, n));
};

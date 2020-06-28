import { v4 as uuid } from 'uuid';

export const createUuid = () => {
  return uuid();
};

export const createTaskId = () => {
  return createUuid();
};

export const createWorkerId = () => {
  return createUuid();
};

export const sleep = async (n: number) => {
  await new Promise((r) => setTimeout(r, n));
};

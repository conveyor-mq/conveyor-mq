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

export const sleep = (n: number) => {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((r) => setTimeout(r, n));
};

export const pickBy = (
  object: Record<string, any>,
  predicate: (value: any, key: string) => boolean,
): Record<string, any> => {
  const obj: Record<string, any> = {};
  const keys = Object.keys(object);
  for (let i = 0; i < keys.length; i += 1) {
    if (predicate(object[keys[i]], keys[i])) {
      obj[keys[i]] = object[keys[i]];
    }
  }
  return obj;
};

export const zipWith = (
  arr1: Array<any>,
  arr2: Array<any>,
  fn: (value: any, value2: any) => any,
) => arr1.map((value, index) => fn(value, arr2[index]));

export const set = (object: Record<string, any>, path: string, value: any) => {
  /* eslint-disable no-param-reassign */
  const [current, ...rest] = path.split('.');
  if (rest.length >= 1) {
    object[current] = object[current] || {};
    set(object[current], rest.join('.'), value);
  } else {
    object[current] = value;
  }
  return object;
};

export const debounce = (fn: (args: []) => any, timeout: number) => {
  let timer: NodeJS.Timeout;
  return (...args: any) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(args), timeout);
  };
};

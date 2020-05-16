import { Task } from '../domain/tasks/task';

export const constant = (factor = 100) => () => factor;

export const linear = (factor = 100) => ({ task }: { task: Task }) =>
  (task.retries || 1) * factor;

export const exponential = (factor = 100) => ({ task }: { task: Task }) =>
  (task.retries || 1) ** 2 * factor;

export const getRetryDelayDefault = ({ task }: { task: Task }) => {
  const strategyMap: {
    [key: string]: (factor?: number) => ({ task }: { task: Task }) => number;
  } = {
    linear,
    exponential,
    constant,
  };
  const strategy = strategyMap[task.retryBackoff?.strategy || 'linear'];
  const delay = strategy(task.retryBackoff?.factor || 100)({ task });
  return delay;
};

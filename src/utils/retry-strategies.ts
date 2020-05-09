import { Task } from '../domain/tasks/task';

export const linear = (factor = 100) => ({ task }: { task: Task }) =>
  (task.attemptCount || 1) * factor;

export const exponential = (factor = 100) => ({ task }: { task: Task }) =>
  (task.attemptCount || 1) ** 2 * factor;

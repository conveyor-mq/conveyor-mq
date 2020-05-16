import { Task } from '../domain/tasks/task';

/**
 * @ignore
 */
export const hasTaskExpired = ({ task, asOf }: { task: Task; asOf: Date }) => {
  return !!task.expiresAt && task.expiresAt < asOf;
};

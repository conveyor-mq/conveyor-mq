import { Moment } from 'moment';
import { Task } from '../domain/tasks/task';

export const hasTaskExpired = ({
  task,
  asOf,
}: {
  task: Task;
  asOf: Moment;
}) => {
  return !!task.expiresOn && task.expiresOn < asOf;
};

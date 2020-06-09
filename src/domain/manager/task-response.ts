import { Task } from '../tasks/task';

export interface TaskResponse {
  task: Task;
  onTaskComplete: () => Promise<Task>;
}

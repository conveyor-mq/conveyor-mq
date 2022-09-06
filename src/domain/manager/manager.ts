import { QueueRateLimitConfig } from '../../actions/get-queue-rate-limit-config';
import { Task } from '../tasks/task';
import { WorkerInstance } from '../worker/worker-instance';
import { TaskResponse } from './task-response';

export interface Manager {
  enqueueTask: (task: Partial<Task>) => Promise<TaskResponse>;
  enqueueTasks: (tasks: Partial<Task>[]) => Promise<TaskResponse[]>;
  scheduleTask: (task: Partial<Task>) => Promise<TaskResponse>;
  scheduleTasks: (tasks: Partial<Task>[]) => Promise<TaskResponse[]>;
  onTaskComplete: (taskId: string) => Promise<Task>;
  getTaskById: (taskId: string) => Promise<Task | null>;
  getTasksById: (taskIds: string[]) => Promise<Task[]>;
  getTaskCounts: () => Promise<{
    scheduledCount: number;
    queuedCount: number;
    processingCount: number;
    successCount: number;
    failedCount: number;
  }>;
  getWorkers: () => Promise<WorkerInstance[]>;
  removeTaskById: (taskId: string) => Promise<void>;
  destroyQueue: () => Promise<void>;
  pauseQueue: () => Promise<void>;
  resumeQueue: () => Promise<void>;
  setQueueRateLimit: ({
    points,
    duration,
  }: {
    points: number;
    duration: number;
  }) => Promise<void>;
  getQueueRateLimit: () => Promise<QueueRateLimitConfig | null>;
  onReady: () => Promise<void>;
  quit: () => Promise<void>;
}

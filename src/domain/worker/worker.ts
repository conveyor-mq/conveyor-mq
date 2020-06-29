import { QueueRateLimitConfig } from '../../actions/get-queue-rate-limit-config';

export interface Worker {
  id: string;
  createdAt: Date;
  onReady: () => Promise<void>;
  pause: () => Promise<void>;
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  getQueueRateLimitConfig: () => Promise<QueueRateLimitConfig | undefined>;
  onIdle: () => Promise<void>;
}

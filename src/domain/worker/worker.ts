export interface Worker {
  id: string;
  createdAt: Date;
  onReady: () => Promise<void>;
  pause: () => Promise<void>;
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  onIdle: () => Promise<void>;
}

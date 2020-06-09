export interface Orchestrator {
  onReady: () => Promise<void>;
  quit: () => Promise<void>;
}

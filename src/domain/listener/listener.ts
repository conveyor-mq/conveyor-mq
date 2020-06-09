import { EventType } from '../events/event-type';
import { Event } from '../events/event';

export interface Listener {
  onReady: () => Promise<void>;
  on: (event: EventType, f: ({ event }: { event: Event }) => any) => void;
  quit: () => Promise<void>;
}

import { Event } from './event';
import { eventFromJson } from './event-from-json';

/**
 * @ignore
 */
export const deSerializeEvent = (eventString: string): Event => {
  return eventFromJson(JSON.parse(eventString));
};

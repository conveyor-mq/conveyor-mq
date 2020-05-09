import { Event } from './event';
import { eventFromJson } from './event-from-json';

export const deSerializeEvent = (eventString: string): Event => {
  return eventFromJson(JSON.parse(eventString));
};

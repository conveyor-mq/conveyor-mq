import { Event } from './event';
import { eventToJson } from './event-to-json';

/**
 * @ignore
 */
export const serializeEvent = (event: Event) => {
  return JSON.stringify(eventToJson(event));
};

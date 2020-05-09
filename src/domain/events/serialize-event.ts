import { Event } from './event';
import { eventToJson } from './event-to-json';

export const serializeEvent = (event: Event) => {
  return JSON.stringify(eventToJson(event));
};

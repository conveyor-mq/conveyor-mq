import * as dateFns from 'date-fns';

export function addByMsToISO(by: number) {
  return dateFns.addMilliseconds(Date.now(), by).toISOString();
}

export function addByMsToDate(by: number) {
  return dateFns.addMilliseconds(Date.now(), by);
}

export function addByHoursToDate(date: number) {
  return dateFns.addHours(Date.now(), date);
}

export function addByHourToDate(date: number) {
  return dateFns.addHours(Date.now(), date);
}

export function dateToUnix(date?: Date | number) {
  if (!date) {
    return Date.now();
  }
  return dateFns.getUnixTime(date);
}

export function subtractByHourToDate(date: number) {
  return dateFns.subHours(Date.now(), date);
}

export function strToDate(dateStr: string) {
  if (!dateStr) {
    return new Date();
  }
  return new Date(dateStr);
}

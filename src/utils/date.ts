import dayjs from 'dayjs';

export function addToDateBy(date: number, by: dayjs.ManipulateType) {
  return dayjs().add(date, by);
}

export function subToDateBy(date: number, by: dayjs.ManipulateType) {
  return dayjs().subtract(date, by);
}

export function addByMsToISO(date: number) {
  return addToDateBy(date, 'milliseconds').toISOString();
}

export function addByMsToDate(date: number) {
  return addToDateBy(date, 'milliseconds').toDate();
}

export function addByHoursToDate(date: number) {
  return addToDateBy(date, 'hours').toDate();
}

export function addByHourToDate(date: number) {
  return addToDateBy(date, 'hour').toDate();
}

export function dateToUnix(date?: Date) {
  return dayjs(date).unix();
}

export function subtractByHourToDate(date: number) {
  return subToDateBy(date, 'hour').toDate();
}

export function strToDate(dateStr: string) {
  return dayjs(dateStr).toDate();
}

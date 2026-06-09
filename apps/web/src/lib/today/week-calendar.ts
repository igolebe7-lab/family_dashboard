export const CALENDAR_START_HOUR = 8;
export const CALENDAR_END_HOUR = 21;
export const HOUR_HEIGHT = 76;
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60;
export const MIN_EVENT_HEIGHT = 56;

export function getCalendarEventTop(time: string): number {
  const [hourPart, minutePart = '0'] = time.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);

  return Math.round(((hour - CALENDAR_START_HOUR) * 60 + minute) * MINUTE_HEIGHT);
}

export function getCalendarHourTop(hour: number): number {
  return getCalendarEventTop(`${hour}:00`);
}

export function getCalendarEventHeight(durationMinutes: number): number {
  return Math.max(MIN_EVENT_HEIGHT, Math.round(durationMinutes * MINUTE_HEIGHT));
}

export function getCalendarBodyHeight(): number {
  return (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT;
}

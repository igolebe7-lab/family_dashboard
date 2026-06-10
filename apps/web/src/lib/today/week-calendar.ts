export const CALENDAR_START_HOUR = 0;
export const CALENDAR_END_HOUR = 24;
export const HOUR_HEIGHT = 76;
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60;
export const MIN_EVENT_HEIGHT = 56;

type CalendarTimeEntry = {
  start: string;
};

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

export function createCalendarTimeLabels(stepHours = 2): string[] {
  return Array.from({ length: Math.floor((CALENDAR_END_HOUR - CALENDAR_START_HOUR) / stepHours) + 1 }, (_, index) => {
    const hour = CALENDAR_START_HOUR + index * stepHours;
    return `${String(hour).padStart(2, '0')}:00`;
  });
}

export function getCalendarInitialScrollTop(events: readonly CalendarTimeEntry[]): number {
  if (events.length === 0) return 0;

  return Math.min(
    ...events.map((event) => Math.max(0, Math.min(getCalendarEventTop(event.start), getCalendarBodyHeight())))
  );
}

import type { ItemOccurrence } from '$lib/types/domain';
import { createDateTimeIso } from './composer-form';

export type ScheduleFormValues = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
};

export function createScheduleFormValues(occurrence: Pick<ItemOccurrence, 'startAt' | 'endAt' | 'allDay'>, timezone: string): ScheduleFormValues {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const fields = (value?: string) => {
    if (!value) return { date: '', time: '' };
    const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(({ type, value }) => [type, value]));
    return { date: `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  };
  const start = fields(occurrence.startAt);
  const end = fields(occurrence.endAt ?? occurrence.startAt);
  return { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time, allDay: occurrence.allDay };
}

export function createScheduleInput(values: ScheduleFormValues, timezone: string):
  | { ok: true; input: { startAt: string; endAt: string } }
  | { ok: false; error: string } {
  try {
    const startAt = createDateTimeIso(values.startDate, values.allDay ? '00:00' : values.startTime, timezone);
    const endAt = createDateTimeIso(values.endDate, values.allDay ? '23:59' : values.endTime, timezone);
    if (endAt <= startAt) return { ok: false, error: 'Окончание должно быть позже начала' };
    return { ok: true, input: { startAt, endAt } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Проверьте дату и время' };
  }
}

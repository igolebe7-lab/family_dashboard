import { addDays, endOfDay, formatISO, parseISO, startOfDay } from 'date-fns';

export type DateRange = {
  start: Date;
  end: Date;
};

export type CalendarView = 'agenda' | 'day' | 'week' | 'month' | 'year';

export function getDayRange(date: Date): DateRange {
  return {
    start: startOfDay(date),
    end: endOfDay(date)
  };
}

export function getWeekRange(date: Date): DateRange {
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = addDays(startOfDay(date), -daysSinceMonday);

  return {
    start: monday,
    end: endOfDay(addDays(monday, 6))
  };
}

export function getMonthRange(date: Date): DateRange {
  const start = startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));

  return { start, end };
}

export function getVisibleRange(view: CalendarView, selectedDate: Date): DateRange {
  if (view === 'day' || view === 'agenda') return getDayRange(selectedDate);
  if (view === 'week') return getWeekRange(selectedDate);
  if (view === 'month') return getMonthRange(selectedDate);

  const start = startOfDay(new Date(selectedDate.getFullYear(), 0, 1));
  const end = endOfDay(new Date(selectedDate.getFullYear(), 11, 31));
  return { start, end };
}

export function toIsoRange(range: DateRange): { start: string; end: string } {
  return {
    start: formatISO(range.start),
    end: formatISO(range.end)
  };
}

export function isValidIsoDate(value: string): boolean {
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime());
}

import { getISOWeek } from 'date-fns';

import { getAnnotationsForDate } from '$lib/day-annotations/day-annotations';
import type { DayAnnotation } from '$lib/types/domain';

export type YearCalendarDay = {
  dateKey: string;
  day: number;
  month: number;
  inCurrentMonth: boolean;
  isWeekend: boolean;
  annotations: DayAnnotation[];
  visibleAnnotations: DayAnnotation[];
  hiddenAnnotationCount: number;
};

export type YearCalendarWeek = {
  weekNumber: number;
  days: YearCalendarDay[];
};

export type YearCalendarMonth = {
  month: number;
  label: string;
  weeks: YearCalendarWeek[];
};

export type YearCalendarViewModel = {
  year: number;
  months: YearCalendarMonth[];
  daysByDate: Map<string, YearCalendarDay>;
};

export type YearCalendarOptions = {
  markerLimit?: number;
};

const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
];

const DAYS_IN_WEEK = 7;

export function createYearCalendarViewModel(
  year: number,
  annotations: readonly DayAnnotation[],
  options: YearCalendarOptions = {}
): YearCalendarViewModel {
  const markerLimit = options.markerLimit ?? 3;
  const daysByDate = new Map<string, YearCalendarDay>();
  const months = MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const weeks = createMonthWeeks(year, month, annotations, markerLimit, daysByDate);

    return {
      month,
      label,
      weeks
    };
  });

  return {
    year,
    months,
    daysByDate
  };
}

function createMonthWeeks(
  year: number,
  month: number,
  annotations: readonly DayAnnotation[],
  markerLimit: number,
  daysByDate: Map<string, YearCalendarDay>
): YearCalendarWeek[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = addUtcDays(firstOfMonth, -getMondayBasedWeekday(firstOfMonth));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const gridEnd = addUtcDays(lastOfMonth, DAYS_IN_WEEK - 1 - getMondayBasedWeekday(lastOfMonth));
  const weeks: YearCalendarWeek[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addUtcDays(cursor, DAYS_IN_WEEK)) {
    const days = Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) => {
      const date = addUtcDays(cursor, dayIndex);
      const day = createCalendarDay(date, month, annotations, markerLimit);
      daysByDate.set(day.dateKey, day);
      return day;
    });

    weeks.push({
      weekNumber: getISOWeek(cursor),
      days
    });
  }

  return weeks;
}

function createCalendarDay(
  date: Date,
  currentMonth: number,
  annotations: readonly DayAnnotation[],
  markerLimit: number
): YearCalendarDay {
  const dateKey = formatDateKey(date);
  const dayAnnotations = getAnnotationsForDate(annotations, dateKey);

  return {
    dateKey,
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    inCurrentMonth: date.getUTCMonth() + 1 === currentMonth,
    isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    annotations: dayAnnotations,
    visibleAnnotations: dayAnnotations.slice(0, markerLimit),
    hiddenAnnotationCount: Math.max(0, dayAnnotations.length - markerLimit)
  };
}

function getMondayBasedWeekday(date: Date): number {
  return (date.getUTCDay() + 6) % DAYS_IN_WEEK;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

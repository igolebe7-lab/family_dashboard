import { createYearCalendarViewModel, type YearCalendarDay } from '$lib/calendar/year-calendar';
import type { DayAnnotation } from '$lib/types/domain';
import type { TodayWeekEvent } from './today-view-model';

export type TodayMonthDay = YearCalendarDay & {
  eventCount: number;
  primaryAnnotationTitle?: string;
};

export type TodayMonthWeek = {
  weekNumber: number;
  days: TodayMonthDay[];
};

export type TodayMonthViewModel = {
  label: string;
  month: number;
  year: number;
  weekdayLabels: string[];
  weeks: TodayMonthWeek[];
};

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function createTodayMonthViewModel(input: {
  annotations: readonly DayAnnotation[];
  date: Date;
  events?: readonly TodayWeekEvent[];
}): TodayMonthViewModel {
  const year = input.date.getFullYear();
  const month = input.date.getMonth() + 1;
  const yearModel = createYearCalendarViewModel(year, input.annotations, { markerLimit: 3 });
  const monthModel = yearModel.months.find((item) => item.month === month);
  const eventCounts = createEventCounts(input.events ?? []);

  if (!monthModel) {
    return {
      label: '',
      month,
      year,
      weekdayLabels: WEEKDAY_LABELS,
      weeks: []
    };
  }

  return {
    label: `${monthModel.label} ${year}`,
    month,
    year,
    weekdayLabels: WEEKDAY_LABELS,
    weeks: monthModel.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      days: week.days.map((day) => ({
        ...day,
        eventCount: eventCounts.get(day.dateKey) ?? 0,
        primaryAnnotationTitle: day.annotations[0]?.title
      }))
    }))
  };
}

function createEventCounts(events: readonly TodayWeekEvent[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.day, (counts.get(event.day) ?? 0) + 1);
  }

  return counts;
}

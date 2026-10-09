import { createMonthCalendarViewModel, type YearCalendarDay } from '$lib/calendar/year-calendar';
import type { DayAnnotation } from '$lib/types/domain';
import type { TodayWeekEvent } from './today-view-model';

export type TodayMonthDay = YearCalendarDay & {
  eventCount: number;
  events: TodayWeekEvent[];
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
  const monthModel = createMonthCalendarViewModel(year, month, input.annotations, { markerLimit: 3 });
  const eventsByDate = new Map<string, TodayWeekEvent[]>();
  for (const event of input.events ?? []) {
    const events = eventsByDate.get(event.day) ?? [];
    events.push(event);
    eventsByDate.set(event.day, events);
  }
  for (const events of eventsByDate.values()) events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

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
        eventCount: eventsByDate.get(day.dateKey)?.length ?? 0,
        events: eventsByDate.get(day.dateKey) ?? [],
        primaryAnnotationTitle: day.annotations[0]?.title
      }))
    }))
  };
}

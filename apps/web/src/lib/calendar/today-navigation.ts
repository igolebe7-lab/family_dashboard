import type { CalendarView } from '$lib/stores/calendar.store';

export type TodayNavigationView = Extract<CalendarView, 'day' | 'week' | 'month'>;

export type TodayNavigationState = {
  date: Date;
  dateKey: string;
  view: TodayNavigationView;
};

const DEFAULT_VIEW: TodayNavigationView = 'day';
const SUPPORTED_VIEWS = new Set<TodayNavigationView>(['day', 'week', 'month']);
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function buildTodayCalendarHref(input: {
  dateKey: string;
  view?: TodayNavigationView;
}): string {
  const params = new URLSearchParams({
    date: input.dateKey,
    view: input.view ?? DEFAULT_VIEW
  });

  return `/app/today?${params.toString()}`;
}

export function parseTodayCalendarSearch(searchParams: URLSearchParams): TodayNavigationState | null {
  const dateKey = searchParams.get('date');
  if (!dateKey) return null;

  const date = parseTodayDateKey(dateKey);
  if (!date) return null;

  return {
    date,
    dateKey,
    view: parseTodayView(searchParams.get('view'))
  };
}

export function parseTodayDateKey(dateKey: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseTodayView(value: string | null): TodayNavigationView {
  return value && SUPPORTED_VIEWS.has(value as TodayNavigationView)
    ? (value as TodayNavigationView)
    : DEFAULT_VIEW;
}

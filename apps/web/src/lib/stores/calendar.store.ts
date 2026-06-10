import { addDays, addMonths } from 'date-fns';
import { writable } from 'svelte/store';

import type { ItemCategory } from '$lib/constants/categories';
import {
  getVisibleRange,
  toIsoRange,
  type CalendarView as DateCalendarView
} from '$lib/utils/date';

export type CalendarView = Exclude<DateCalendarView, 'year'>;

export type CalendarVisibleRange = {
  from: string;
  to: string;
};

export type CalendarFilters = {
  categories: ItemCategory[];
  members: string[];
};

export type CalendarState = {
  availableViews: CalendarView[];
  view: CalendarView;
  selectedDate: Date;
  selectedDateKey: string;
  visibleRange: CalendarVisibleRange;
  filters: CalendarFilters;
};

export type CalendarStoreOptions = {
  selectedDate?: Date;
  view?: CalendarView;
};

const AVAILABLE_VIEWS: CalendarView[] = ['agenda', 'day', 'week', 'month'];

const initialFilters: CalendarFilters = {
  categories: [],
  members: []
};

export function createCalendarStore(options: CalendarStoreOptions = {}) {
  const store = writable<CalendarState>(
    createCalendarState(options.selectedDate ?? new Date(), options.view ?? 'week')
  );

  return {
    subscribe: store.subscribe,
    setView: (view: DateCalendarView) => {
      assertMvpView(view);
      store.update((state) => createCalendarState(state.selectedDate, view, state.filters));
    },
    setSelectedDate: (date: Date) =>
      store.update((state) => createCalendarState(date, state.view, state.filters)),
    goPrevious: () =>
      store.update((state) =>
        createCalendarState(shiftDate(state.selectedDate, state.view, -1), state.view, state.filters)
      ),
    goNext: () =>
      store.update((state) =>
        createCalendarState(shiftDate(state.selectedDate, state.view, 1), state.view, state.filters)
      ),
    toggleCategory: (category: ItemCategory) =>
      store.update((state) =>
        createCalendarState(state.selectedDate, state.view, {
          ...state.filters,
          categories: toggleValue(state.filters.categories, category)
        })
      ),
    toggleMember: (memberId: string) =>
      store.update((state) =>
        createCalendarState(state.selectedDate, state.view, {
          ...state.filters,
          members: toggleValue(state.filters.members, memberId)
        })
      ),
    clearFilters: () =>
      store.update((state) => createCalendarState(state.selectedDate, state.view, initialFilters))
  };
}

function createCalendarState(
  selectedDate: Date,
  view: CalendarView,
  filters: CalendarFilters = initialFilters
): CalendarState {
  const range = toIsoRange(getVisibleRange(view, selectedDate));

  return {
    availableViews: AVAILABLE_VIEWS,
    view,
    selectedDate,
    selectedDateKey: formatDateKey(selectedDate),
    visibleRange: {
      from: range.start,
      to: range.end
    },
    filters: {
      categories: [...filters.categories],
      members: [...filters.members]
    }
  };
}

function assertMvpView(view: DateCalendarView): asserts view is CalendarView {
  if (view === 'year') {
    throw new Error('Calendar view "year" is reserved for post-MVP');
  }
}

function shiftDate(date: Date, view: CalendarView, direction: -1 | 1): Date {
  if (view === 'month') return addMonths(date, direction);
  if (view === 'week') return addDays(date, direction * 7);
  return addDays(date, direction);
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const calendarStore = createCalendarStore();

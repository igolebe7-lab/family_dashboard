import { addDays, addMonths } from 'date-fns';
import { get, writable } from 'svelte/store';

import { listOccurrencesInRange } from '$lib/api/occurrences.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { ItemCategory } from '$lib/constants/categories';
import type { ItemOccurrence } from '$lib/types/domain';
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

export type CalendarStatus = 'idle' | 'loading' | 'ready' | 'error';

export type CalendarState = {
  availableViews: CalendarView[];
  view: CalendarView;
  selectedDate: Date;
  selectedDateKey: string;
  visibleRange: CalendarVisibleRange;
  filters: CalendarFilters;
  status: CalendarStatus;
  occurrences: ItemOccurrence[];
  filteredOccurrences: ItemOccurrence[];
  totalItems: number;
  error: string | null;
};

export type CalendarStoreOptions = {
  selectedDate?: Date;
  view?: CalendarView;
};

export type CalendarLoadDependencies = {
  listOccurrencesInRange?: typeof listOccurrencesInRange;
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
      store.update((state) => createCalendarState(state.selectedDate, view, state.filters, state));
    },
    setSelectedDate: (date: Date) =>
      store.update((state) => createCalendarState(date, state.view, state.filters, state)),
    goPrevious: () =>
      store.update((state) =>
        createCalendarState(shiftDate(state.selectedDate, state.view, -1), state.view, state.filters, state)
      ),
    goNext: () =>
      store.update((state) =>
        createCalendarState(shiftDate(state.selectedDate, state.view, 1), state.view, state.filters, state)
      ),
    toggleCategory: (category: ItemCategory) =>
      store.update((state) =>
        createCalendarState(state.selectedDate, state.view, {
          ...state.filters,
          categories: toggleValue(state.filters.categories, category)
        }, state)
      ),
    toggleMember: (memberId: string) =>
      store.update((state) =>
        createCalendarState(state.selectedDate, state.view, {
          ...state.filters,
          members: toggleValue(state.filters.members, memberId)
        }, state)
      ),
    clearCategories: () =>
      store.update((state) =>
        createCalendarState(state.selectedDate, state.view, {
          ...state.filters,
          categories: []
        }, state)
      ),
    clearMembers: () =>
      store.update((state) =>
        createCalendarState(state.selectedDate, state.view, {
          ...state.filters,
          members: []
        }, state)
      ),
    clearFilters: () =>
      store.update((state) => createCalendarState(state.selectedDate, state.view, initialFilters, state)),
    loadVisibleOccurrences: async (
      context: ActiveFamilyContext,
      dependencies: CalendarLoadDependencies = {}
    ): Promise<ItemOccurrence[]> => {
      const loader = dependencies.listOccurrencesInRange ?? listOccurrencesInRange;
      const range = get(store).visibleRange;

      store.update((state) => ({
        ...state,
        status: 'loading',
        error: null
      }));

      try {
        const result = await loader(context, range);

        store.update((state) => ({
          ...state,
          status: 'ready',
          occurrences: result.items,
          filteredOccurrences: filterOccurrences(result.items, state.filters),
          totalItems: result.totalItems,
          error: null
        }));

        return result.items;
      } catch (error) {
        store.update((state) => ({
          ...state,
          status: 'error',
          occurrences: [],
          filteredOccurrences: [],
          totalItems: 0,
          error: 'Не удалось загрузить календарь'
        }));
        throw error;
      }
    }
  };
}

function createCalendarState(
  selectedDate: Date,
  view: CalendarView,
  filters: CalendarFilters = initialFilters,
  existingState?: Pick<CalendarState, 'status' | 'occurrences' | 'totalItems' | 'error'>
): CalendarState {
  const range = toIsoRange(getVisibleRange(view, selectedDate));
  const occurrences = existingState?.occurrences ?? [];

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
    },
    status: existingState?.status ?? 'idle',
    occurrences,
    filteredOccurrences: filterOccurrences(occurrences, filters),
    totalItems: existingState?.totalItems ?? 0,
    error: existingState?.error ?? null
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

function filterOccurrences(
  occurrences: ItemOccurrence[],
  filters: CalendarFilters
): ItemOccurrence[] {
  return occurrences.filter((occurrence) => {
    const matchesCategory =
      filters.categories.length === 0 || filters.categories.includes(occurrence.categorySnapshot);
    const matchesMember =
      filters.members.length === 0 ||
      occurrence.visibleTo.some((memberId) => filters.members.includes(memberId));

    return matchesCategory && matchesMember;
  });
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const calendarStore = createCalendarStore();

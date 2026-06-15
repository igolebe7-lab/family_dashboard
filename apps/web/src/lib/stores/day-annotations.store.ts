import { get, writable } from 'svelte/store';

import { listDayAnnotationsForYear } from '$lib/api/day-annotations.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { getAnnotationsForYear } from '$lib/day-annotations/day-annotations';
import type { DayAnnotation } from '$lib/types/domain';

export type DayAnnotationsStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DayAnnotationsState = {
  selectedYear: number;
  status: DayAnnotationsStatus;
  annotations: DayAnnotation[];
  projectedAnnotations: DayAnnotation[];
  totalItems: number;
  error: string | null;
};

export type DayAnnotationsStoreOptions = {
  selectedYear?: number;
};

export type DayAnnotationsLoadDependencies = {
  listDayAnnotationsForYear?: typeof listDayAnnotationsForYear;
};

export function createDayAnnotationsStore(options: DayAnnotationsStoreOptions = {}) {
  const store = writable<DayAnnotationsState>(
    createDayAnnotationsState(options.selectedYear ?? new Date().getFullYear())
  );

  return {
    subscribe: store.subscribe,
    setYear: (year: number) => store.update((state) => createDayAnnotationsState(year, state)),
    goPreviousYear: () =>
      store.update((state) => createDayAnnotationsState(state.selectedYear - 1, state)),
    goNextYear: () =>
      store.update((state) => createDayAnnotationsState(state.selectedYear + 1, state)),
    loadYear: async (
      context: ActiveFamilyContext,
      dependencies: DayAnnotationsLoadDependencies = {}
    ): Promise<DayAnnotation[]> => {
      const loader = dependencies.listDayAnnotationsForYear ?? listDayAnnotationsForYear;
      const year = get(store).selectedYear;

      store.update((state) => ({
        ...state,
        status: 'loading',
        error: null
      }));

      try {
        const result = await loader(context, year);

        store.update((state) => ({
          ...state,
          status: 'ready',
          annotations: result.items,
          projectedAnnotations: getAnnotationsForYear(result.items, state.selectedYear),
          totalItems: result.totalItems,
          error: null
        }));

        return result.items;
      } catch (error) {
        store.update((state) => ({
          ...state,
          status: 'error',
          annotations: [],
          projectedAnnotations: [],
          totalItems: 0,
          error: 'Не удалось загрузить особые даты'
        }));
        throw error;
      }
    }
  };
}

function createDayAnnotationsState(
  selectedYear: number,
  existingState?: Pick<DayAnnotationsState, 'status' | 'annotations' | 'totalItems' | 'error'>
): DayAnnotationsState {
  const annotations = existingState?.annotations ?? [];

  return {
    selectedYear,
    status: existingState?.status ?? 'idle',
    annotations,
    projectedAnnotations: getAnnotationsForYear(annotations, selectedYear),
    totalItems: existingState?.totalItems ?? 0,
    error: existingState?.error ?? null
  };
}

export const dayAnnotationsStore = createDayAnnotationsStore();

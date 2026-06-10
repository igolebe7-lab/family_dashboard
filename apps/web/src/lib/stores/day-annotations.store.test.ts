import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { DayAnnotation } from '$lib/types/domain';
import { createDayAnnotationsStore } from './day-annotations.store';

const context: ActiveFamilyContext = {
  familyId: 'family_1',
  memberId: 'member_mom'
};

const birthday: DayAnnotation = {
  id: 'birthday_vladimir',
  family: 'family_1',
  kind: 'birthday',
  title: 'День рождения Владимира',
  month: 3,
  day: 12,
  recurrence: 'yearly',
  color: 'blue',
  tone: 'positive',
  visibility: 'family',
  source: 'manual',
  readonly: false,
  personName: 'Владимир',
  personRelation: 'коллега',
  personContact: '+7 999 000-00-00',
  createdBy: 'member_mom'
};

const oneTimeDate: DayAnnotation = {
  id: 'school_start',
  family: 'family_1',
  kind: 'family_date',
  title: 'Первый день школы',
  month: 9,
  day: 1,
  year: 2026,
  recurrence: 'one_time',
  color: 'green',
  tone: 'important',
  visibility: 'family',
  source: 'manual',
  readonly: false,
  createdBy: 'member_mom'
};

describe('createDayAnnotationsStore', () => {
  it('moves between years without mutating annotations', () => {
    const store = createDayAnnotationsStore({ selectedYear: 2026 });

    store.goNextYear();
    expect(get(store).selectedYear).toBe(2027);

    store.goPreviousYear();
    expect(get(store).selectedYear).toBe(2026);
  });

  it('loads annotations and projects recurring records into the selected year', async () => {
    const store = createDayAnnotationsStore({ selectedYear: 2026 });
    const listDayAnnotationsForYear = vi.fn().mockResolvedValue({
      items: [birthday, oneTimeDate],
      totalItems: 2
    });

    await store.loadYear(context, { listDayAnnotationsForYear });

    expect(listDayAnnotationsForYear).toHaveBeenCalledWith(context, 2026);
    expect(get(store)).toMatchObject({
      status: 'ready',
      annotations: [birthday, oneTimeDate],
      projectedAnnotations: [birthday, oneTimeDate],
      totalItems: 2,
      error: null
    });
  });

  it('reprojects yearly annotations when selected year changes', async () => {
    const store = createDayAnnotationsStore({ selectedYear: 2026 });

    await store.loadYear(context, {
      listDayAnnotationsForYear: vi.fn().mockResolvedValue({
        items: [birthday, oneTimeDate],
        totalItems: 2
      })
    });

    store.setYear(2027);

    expect(get(store).projectedAnnotations).toEqual([birthday]);
  });

  it('stores a user-facing error when loading fails', async () => {
    const store = createDayAnnotationsStore({ selectedYear: 2026 });

    await expect(
      store.loadYear(context, {
        listDayAnnotationsForYear: vi.fn().mockRejectedValue(new Error('PocketBase unavailable'))
      })
    ).rejects.toThrow('PocketBase unavailable');

    expect(get(store)).toMatchObject({
      status: 'error',
      annotations: [],
      projectedAnnotations: [],
      totalItems: 0,
      error: 'Не удалось загрузить особые даты'
    });
  });
});

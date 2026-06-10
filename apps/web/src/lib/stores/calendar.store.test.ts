import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { ItemOccurrence } from '$lib/types/domain';
import { createCalendarStore } from './calendar.store';

const context: ActiveFamilyContext = {
  familyId: 'family_1',
  memberId: 'member_misha'
};

const schoolOccurrence: ItemOccurrence = {
  id: 'occ_school',
  family: 'family_1',
  item: 'item_school',
  visibleTo: ['member_misha'],
  kind: 'event',
  titleSnapshot: 'Школа',
  categorySnapshot: 'school',
  startAt: '2026-06-10T08:00:00.000+02:00',
  endAt: '2026-06-10T09:00:00.000+02:00',
  allDay: false,
  status: 'todo'
};

const trainingOccurrence: ItemOccurrence = {
  id: 'occ_training',
  family: 'family_1',
  item: 'item_training',
  visibleTo: ['member_anya'],
  kind: 'event',
  titleSnapshot: 'Тренировка',
  categorySnapshot: 'sport',
  startAt: '2026-06-10T18:00:00.000+02:00',
  endAt: '2026-06-10T19:00:00.000+02:00',
  allDay: false,
  status: 'todo'
};

describe('createCalendarStore', () => {
  it('calculates API visible ranges for day, week, month and agenda views', () => {
    const store = createCalendarStore({
      selectedDate: new Date('2026-06-10T12:00:00.000+02:00')
    });

    expect(get(store).visibleRange).toEqual({
      from: '2026-06-08T00:00:00+02:00',
      to: '2026-06-14T23:59:59+02:00'
    });

    store.setView('day');
    expect(get(store).visibleRange).toEqual({
      from: '2026-06-10T00:00:00+02:00',
      to: '2026-06-10T23:59:59+02:00'
    });

    store.setView('month');
    expect(get(store).visibleRange).toEqual({
      from: '2026-06-01T00:00:00+02:00',
      to: '2026-06-30T23:59:59+02:00'
    });

    store.setView('agenda');
    expect(get(store).visibleRange).toEqual({
      from: '2026-06-10T00:00:00+02:00',
      to: '2026-06-10T23:59:59+02:00'
    });
  });

  it('moves the selected date by the active view range', () => {
    const store = createCalendarStore({
      selectedDate: new Date('2026-06-10T12:00:00.000+02:00')
    });

    store.goNext();
    expect(get(store).selectedDateKey).toBe('2026-06-17');
    expect(get(store).visibleRange.from).toBe('2026-06-15T00:00:00+02:00');

    store.setView('day');
    store.goPrevious();
    expect(get(store).selectedDateKey).toBe('2026-06-16');

    store.setView('month');
    store.goNext();
    expect(get(store).selectedDateKey).toBe('2026-07-16');
  });

  it('tracks category and member filters without duplicates', () => {
    const store = createCalendarStore();

    store.toggleCategory('school');
    store.toggleCategory('school');
    store.toggleCategory('sport');
    store.toggleMember('member_misha');
    store.toggleMember('member_misha');
    store.toggleMember('member_anya');

    expect(get(store).filters).toEqual({
      categories: ['sport'],
      members: ['member_anya']
    });

    store.clearFilters();
    expect(get(store).filters).toEqual({
      categories: [],
      members: []
    });
  });

  it('clears category and member filters independently', () => {
    const store = createCalendarStore();

    store.toggleCategory('school');
    store.toggleMember('member_misha');

    store.clearCategories();
    expect(get(store).filters).toEqual({
      categories: [],
      members: ['member_misha']
    });

    store.clearMembers();
    expect(get(store).filters).toEqual({
      categories: [],
      members: []
    });
  });

  it('keeps year view reserved outside the MVP calendar store', () => {
    const store = createCalendarStore();

    expect(get(store).availableViews).toEqual(['agenda', 'day', 'week', 'month']);
    expect(() => store.setView('year')).toThrow('Calendar view "year" is reserved for post-MVP');
  });

  it('loads occurrences only for the current visible range', async () => {
    const listOccurrencesInRange = vi.fn().mockResolvedValue({
      items: [schoolOccurrence, trainingOccurrence],
      totalItems: 2
    });
    const store = createCalendarStore({
      selectedDate: new Date('2026-06-10T12:00:00.000+02:00')
    });

    const result = await store.loadVisibleOccurrences(context, { listOccurrencesInRange });

    expect(listOccurrencesInRange).toHaveBeenCalledWith(context, {
      from: '2026-06-08T00:00:00+02:00',
      to: '2026-06-14T23:59:59+02:00'
    });
    expect(result).toEqual([schoolOccurrence, trainingOccurrence]);
    expect(get(store)).toMatchObject({
      status: 'ready',
      occurrences: [schoolOccurrence, trainingOccurrence],
      filteredOccurrences: [schoolOccurrence, trainingOccurrence],
      totalItems: 2,
      error: null
    });
  });

  it('filters loaded occurrences by selected categories and members', async () => {
    const store = createCalendarStore();

    await store.loadVisibleOccurrences(context, {
      listOccurrencesInRange: vi.fn().mockResolvedValue({
        items: [schoolOccurrence, trainingOccurrence],
        totalItems: 2
      })
    });

    store.toggleCategory('sport');
    expect(get(store).filteredOccurrences).toEqual([trainingOccurrence]);

    store.toggleMember('member_misha');
    expect(get(store).filteredOccurrences).toEqual([]);

    store.toggleCategory('sport');
    expect(get(store).filteredOccurrences).toEqual([schoolOccurrence]);

    store.clearFilters();
    expect(get(store).filteredOccurrences).toEqual([schoolOccurrence, trainingOccurrence]);
  });

  it('stores a user-facing error when occurrence loading fails', async () => {
    const store = createCalendarStore();

    await expect(
      store.loadVisibleOccurrences(context, {
        listOccurrencesInRange: vi.fn().mockRejectedValue(new Error('PocketBase unavailable'))
      })
    ).rejects.toThrow('PocketBase unavailable');

    expect(get(store)).toMatchObject({
      status: 'error',
      occurrences: [],
      totalItems: 0,
      error: 'Не удалось загрузить календарь'
    });
  });
});

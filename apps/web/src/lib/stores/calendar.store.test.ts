import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import { createCalendarStore } from './calendar.store';

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

  it('keeps year view reserved outside the MVP calendar store', () => {
    const store = createCalendarStore();

    expect(get(store).availableViews).toEqual(['agenda', 'day', 'week', 'month']);
    expect(() => store.setView('year')).toThrow('Calendar view "year" is reserved for post-MVP');
  });
});

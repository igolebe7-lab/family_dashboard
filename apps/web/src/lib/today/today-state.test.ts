import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTodayState } from './today-state';
import { createTodayViewModel } from './today-view-model';
import type { ActivityRecord, ItemOccurrence } from '$lib/types/domain';

const context = { familyId: 'family', memberId: 'parent' };
const date = new Date(2026, 5, 10);
const feed: ActivityRecord[] = [{ id: 'activity', family: 'family', actor: 'parent', summary: 'Запись', action: 'item.created', created: '2026-06-10T08:00:00Z' }];

describe('Today request lifecycle', () => {
  afterEach(() => vi.useRealTimers());
  it('revalidates an expired range on navigation without background polling', async () => {
    vi.useFakeTimers();
    const listOccurrences = vi.fn().mockResolvedValue({ items: [], totalItems: 0 });
    const state = createTodayState({ listOccurrences, listActivity: async () => [], listNotifications: async () => [] });
    const input = { context, date, view: 'day' as const, members: [], timezone: 'Europe/Moscow' };
    await state.load(input); await state.load(input);
    expect(listOccurrences).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61000);
    expect(listOccurrences).toHaveBeenCalledTimes(1);
    await state.load({ ...input, date: new Date(2026, 5, 11) });
    expect(listOccurrences).toHaveBeenCalledTimes(2);
  });
  it('purges revoked records immediately and ignores their in-flight responses', async () => {
    let resolve!: (result: { items: ItemOccurrence[]; totalItems: number }) => void;
    const rows: ItemOccurrence[] = [{ id: 'secret', family: 'family', item: 'event', kind: 'event', visibleTo: ['parent'], titleSnapshot: 'Revoked', categorySnapshot: 'family', startAt: '2026-06-10T08:00:00Z', allDay: false, status: 'todo' }];
    const listOccurrences = vi.fn().mockResolvedValueOnce({ items: rows, totalItems: 1 })
      .mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ items: [], totalItems: 0 });
    const state = createTodayState({ listOccurrences, listActivity: vi.fn().mockResolvedValue(feed), listNotifications: async () => [] });
    const input = { context, date, view: 'day' as const, members: [], timezone: 'Europe/Moscow' };
    await state.load(input); const pending = state.refreshOccurrences();
    state.invalidate();
    expect(get(state).model.timelineItems).toHaveLength(0);
    expect(get(state).feedItems).toHaveLength(0);
    resolve({ items: rows, totalItems: 1 }); await pending;
    expect(get(state).model.timelineItems).toHaveLength(0);
    await state.load(input); expect(listOccurrences).toHaveBeenCalledTimes(3);
  });
  it('does not discard a realtime refresh when navigating within its cached week', async () => {
    let resolve!: (result: { items: ItemOccurrence[]; totalItems: number }) => void;
    const listOccurrences = vi.fn().mockResolvedValueOnce({ items: [], totalItems: 0 })
      .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const state = createTodayState({ listOccurrences, listActivity: async () => [], listNotifications: async () => [] });
    const input = { context, date, view: 'day' as const, members: [], timezone: 'Europe/Moscow' };
    await state.load(input);
    const pending = state.refreshOccurrences();
    await state.load({ ...input, date: new Date(2026, 5, 11) });
    resolve({ items: [{ id: 'new', family: 'family', item: 'event', kind: 'event', visibleTo: ['parent'], titleSnapshot: 'Live update', categorySnapshot: 'family', startAt: '2026-06-11T08:00:00Z', allDay: false, status: 'todo' }], totalItems: 1 });
    await pending;
    expect(get(state).model.timelineItems[0]?.title).toBe('Live update');
    expect(get(state).model.dateLabel).toContain('11 июня');
    expect(listOccurrences).toHaveBeenCalledTimes(2);
  });
  it('keeps only one range and never reuses records across families or timezones', async () => {
    const listOccurrences = vi.fn().mockResolvedValue({ items: [], totalItems: 0 });
    const listActivity = vi.fn().mockResolvedValue([]), listNotifications = vi.fn().mockResolvedValue([]);
    const state = createTodayState({ listOccurrences, listActivity, listNotifications });
    const input = { context, date, view: 'day' as const, members: [], timezone: 'Europe/Moscow' };
    await state.load(input);
    await state.load({ ...input, date: new Date(2026, 5, 18) });
    await state.load(input);
    expect(listOccurrences).toHaveBeenCalledTimes(3);
    expect(listActivity).toHaveBeenCalledTimes(1);
    await state.load({ ...input, timezone: 'UTC' });
    await state.load({ ...input, context: { ...context, familyId: 'other' } });
    expect(listOccurrences).toHaveBeenCalledTimes(5);
    expect(listActivity).toHaveBeenCalledTimes(3);
    state.reset(); await state.load(input);
    expect(listOccurrences).toHaveBeenCalledTimes(6);
  });
  it('invalidates the cache on failed refresh and retries the same week', async () => {
    const listOccurrences = vi.fn().mockResolvedValueOnce({ items: [], totalItems: 0 })
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [], totalItems: 0 });
    const state = createTodayState({ listOccurrences, listActivity: async () => [], listNotifications: async () => [] });
    const input = { context, date, view: 'day' as const, members: [], timezone: 'Europe/Moscow' };
    await state.load(input); await state.refreshOccurrences();
    expect(get(state).status).toBe('error');
    await state.load(input);
    expect(get(state).status).toBe('ready');
    expect(listOccurrences).toHaveBeenCalledTimes(3);
  });
  it('ignores an old range response without discarding an in-flight family feed', async () => {
    let resolveRows!: (result: { items: ItemOccurrence[]; totalItems: number }) => void;
    let resolveFeed!: (result: typeof feed) => void;
    const listOccurrences = vi.fn().mockImplementationOnce(() => new Promise(done => { resolveRows = done; }))
      .mockResolvedValue({ items: [], totalItems: 0 });
    const state = createTodayState({ listOccurrences,
      listActivity: () => new Promise(done => { resolveFeed = done; }), listNotifications: async () => [] });
    const input = { context, date, view: 'day' as const, members: [], timezone: 'Europe/Moscow' };
    const pending = state.load(input);
    await state.load({ ...input, date: new Date(2026, 5, 18) });
    resolveFeed(feed); resolveRows({ items: [], totalItems: 0 }); await pending;
    expect(get(state).model.dateLabel).toContain('18 июня');
    expect(get(state).feedItems).toHaveLength(1);
    await state.load({ ...input, date: new Date(2026, 5, 19) });
    expect(listOccurrences).toHaveBeenCalledTimes(2);
  });
  it('reprojects an already loaded week without refetching unrelated data', async () => {
    const rows: ItemOccurrence[] = [{ id: 'tomorrow', family: 'family', item: 'event', kind: 'event', visibleTo: ['parent'], titleSnapshot: 'Tomorrow', categorySnapshot: 'family', startAt: '2026-06-11T08:00:00Z', endAt: '2026-06-11T09:00:00Z', allDay: false, status: 'todo' }];
    const listOccurrences = vi.fn().mockResolvedValue({ items: rows, totalItems: 1 });
    const listActivity = vi.fn().mockResolvedValue(feed), listNotifications = vi.fn().mockResolvedValue([{}]);
    const state = createTodayState({ listOccurrences, listActivity, listNotifications });
    await state.load({ context, date, view: 'day', members: [], timezone: 'Europe/Moscow' });
    expect(get(state).model.timelineItems).toHaveLength(0);
    await state.load({ context, date: new Date(2026, 5, 11), view: 'week', members: [], timezone: 'Europe/Moscow' });
    expect(get(state).model.timelineItems[0].title).toBe('Tomorrow');
    expect(get(state).notificationCount).toBe(1);
    expect(listOccurrences).toHaveBeenCalledTimes(1);
    expect(listActivity).toHaveBeenCalledTimes(1);
    expect(listNotifications).toHaveBeenCalledTimes(1);
    await state.refreshOccurrences();
    expect(listOccurrences).toHaveBeenCalledTimes(2);
    await state.load({ context: { ...context, memberId: 'child' }, date, view: 'day', members: [], timezone: 'Europe/Moscow' });
    expect(listOccurrences).toHaveBeenCalledTimes(3);
    expect(listActivity).toHaveBeenCalledTimes(2);
  });
  it('does not lose the loaded feed when occurrences finish later', async () => {
    let resolve!: (model: ReturnType<typeof createTodayViewModel>) => void;
    const state = createTodayState({
      loadToday: () => new Promise((done) => { resolve = done; }),
      listActivity: vi.fn().mockResolvedValue(feed),
      listNotifications: vi.fn().mockResolvedValue([])
    });
    const pending = state.load({ context, date, view: 'week', members: [] });
    await Promise.resolve();
    expect(get(state).feedItems).toHaveLength(1);
    resolve(createTodayViewModel(date));
    await pending;
    expect(get(state).feedItems).toHaveLength(1);
  });

  it('ignores late responses and clears all state when context disappears', async () => {
    let resolve!: (model: ReturnType<typeof createTodayViewModel>) => void;
    const state = createTodayState({
      loadToday: () => new Promise((done) => { resolve = done; }),
      listActivity: vi.fn().mockResolvedValue(feed),
      listNotifications: vi.fn().mockResolvedValue([{}])
    });
    const pending = state.load({ context, date, view: 'week', members: [] });
    state.reset(date);
    resolve(createTodayViewModel({ fixture: 'desktop-reference' }));
    await pending;
    expect(get(state).model.weekEvents).toEqual([]);
    expect(get(state).feedItems).toEqual([]);
    expect(get(state).notificationCount).toBe(0);
  });

  it('allows retry after an error and keeps a newer context authoritative', async () => {
    let reject!: (error: Error) => void;
    const loader = vi.fn()
      .mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(createTodayViewModel(date));
    const state = createTodayState({ loadToday: loader, listActivity: vi.fn().mockResolvedValue([]), listNotifications: vi.fn().mockResolvedValue([]) });
    const pending = state.load({ context, date, view: 'week', members: [] });
    const next = { context: { ...context, memberId: 'child' }, date, view: 'week' as const, members: [] };
    await state.load(next);
    expect(get(state).error).toBeTruthy();
    await state.load(next);
    reject(new Error('old request'));
    await pending;
    expect(get(state).error).toBeNull();
    expect(get(state).status).toBe('ready');
  });
});

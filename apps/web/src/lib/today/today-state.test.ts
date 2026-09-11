import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { createTodayState } from './today-state';
import { createTodayViewModel } from './today-view-model';

const context = { familyId: 'family', memberId: 'parent' };
const date = new Date(2026, 5, 10);
const feed = [{ id: 'activity', actor: 'parent', summary: 'Запись', action: 'event.created', created: '2026-06-10T08:00:00Z' }];

describe('Today request lifecycle', () => {
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

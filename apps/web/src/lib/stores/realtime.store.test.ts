import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRealtimeStore } from './realtime.store';

describe('realtime store lifecycle', () => {
  afterEach(() => vi.useRealTimers());
  const context = { familyId: 'family_1', memberId: 'member_mom' };
  it('batches neutral family invalidation and releases recovery listeners', async () => {
    vi.useFakeTimers();
    let invalidate!: () => void, reconnect!: () => void;
    const releaseFamily = vi.fn(), releaseRecovery = vi.fn();
    const store = createRealtimeStore({
      subscribeFamilyChanges: async (_context, notify) => { invalidate = notify; return releaseFamily; },
      subscribeReconnect: async notify => { reconnect = notify; return releaseRecovery; }
    });
    const changed = vi.fn(), recovered = vi.fn();
    await store.syncFamilyChanges(context, changed); await store.syncRecovery(context, recovered);
    invalidate(); invalidate(); reconnect(); await vi.advanceTimersByTimeAsync(150);
    expect(changed).toHaveBeenCalledTimes(1); expect(recovered).toHaveBeenCalledTimes(1);
    store.stopAll(); invalidate(); reconnect(); await vi.advanceTimersByTimeAsync(150);
    expect(changed).toHaveBeenCalledTimes(1); expect(recovered).toHaveBeenCalledTimes(1);
    expect(releaseFamily).toHaveBeenCalledTimes(1); expect(releaseRecovery).toHaveBeenCalledTimes(1);
  });
  it('releases superseded pending subscriptions and isolates activity per member', async () => {
    vi.useFakeTimers();
    let resolve!: (unsubscribe: () => void) => void;
    let oldNotify!: () => void;
    const oldUnsubscribe = vi.fn(), nextUnsubscribe = vi.fn(), changed = vi.fn();
    const subscribeActivity = vi.fn().mockImplementationOnce((_context, notify) => {
      oldNotify = notify;
      return new Promise(done => { resolve = done; });
    }).mockResolvedValue(nextUnsubscribe);
    const store = createRealtimeStore({ subscribeActivity });
    const first = store.syncActivity(context, changed);
    await store.syncActivity({ ...context, memberId: 'child' }, changed);
    resolve(oldUnsubscribe); await first;
    oldNotify(); await vi.advanceTimersByTimeAsync(150);
    expect(changed).not.toHaveBeenCalled();
    expect(oldUnsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribeActivity).toHaveBeenCalledTimes(2);
    store.stopAll(); expect(nextUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('coalesces bursts and cancels queued callbacks when leaving a scope', async () => {
    vi.useFakeTimers();
    let notify!: () => void;
    const store = createRealtimeStore({ subscribeOccurrences: async (_context, _range, callback) => { notify = callback; return vi.fn(); } });
    const changed = vi.fn();
    await store.syncOccurrences(context, { from: 'a', to: 'b' }, changed);
    for (let i = 0; i < 100; i++) notify();
    expect(changed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(changed).toHaveBeenCalledTimes(1);
    notify(); store.stopAll();
    await vi.advanceTimersByTimeAsync(150);
    notify(); await vi.advanceTimersByTimeAsync(150);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('releases a subscription that finishes after stopAll', async () => {
    let resolve!: (unsubscribe: () => void) => void;
    const unsubscribe = vi.fn();
    const store = createRealtimeStore({ subscribeActivity: () => new Promise(done => { resolve = done; }) });
    const pending = store.syncActivity(context, vi.fn());
    store.stopAll(); resolve(unsubscribe); await pending;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles a rejected async unsubscribe when leaving a calendar range', async () => {
    const error = new Error('Request cancelled during navigation');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const unsubscribe = vi.fn().mockRejectedValue(error);
      const store = createRealtimeStore({ subscribeActivity: vi.fn().mockResolvedValue(unsubscribe) });
      await store.syncActivity(context, vi.fn());
      store.stopAll();
      await Promise.resolve();
      expect(warning).toHaveBeenCalledWith('Realtime subscription cleanup failed.', error);
      store.stopAll();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });

  it('resubscribes notifications when the active recipient member changes', async () => {
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();
    const subscribeNotifications = vi
      .fn()
      .mockResolvedValueOnce(firstUnsubscribe)
      .mockResolvedValueOnce(secondUnsubscribe);
    const store = createRealtimeStore({ subscribeNotifications });
    const onChange = vi.fn();

    await store.syncNotifications(context, onChange);
    await store.syncNotifications(context, onChange);
    await store.syncNotifications({ familyId: 'family_1', memberId: 'member_dad' }, onChange);
    store.stopAll();

    expect(subscribeNotifications).toHaveBeenCalledTimes(2);
    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('resubscribes activity when the active family changes', async () => {
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();
    const subscribeActivity = vi
      .fn()
      .mockResolvedValueOnce(firstUnsubscribe)
      .mockResolvedValueOnce(secondUnsubscribe);
    const store = createRealtimeStore({ subscribeActivity });
    const onChange = vi.fn();

    await store.syncActivity(context, onChange);
    await store.syncActivity({ familyId: 'family_2', memberId: 'member_mom' }, onChange);
    store.stopActivity();

    expect(subscribeActivity).toHaveBeenCalledTimes(2);
    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('resubscribes occurrences when the visible range changes', async () => {
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();
    const subscribeOccurrences = vi
      .fn()
      .mockResolvedValueOnce(firstUnsubscribe)
      .mockResolvedValueOnce(secondUnsubscribe);
    const store = createRealtimeStore({ subscribeOccurrences });
    const onChange = vi.fn();
    const weekRange = {
      from: '2026-06-15T00:00:00.000Z',
      to: '2026-06-22T00:00:00.000Z'
    };
    const nextWeekRange = {
      from: '2026-06-22T00:00:00.000Z',
      to: '2026-06-29T00:00:00.000Z'
    };

    await store.syncOccurrences(context, weekRange, onChange);
    await store.syncOccurrences(context, weekRange, onChange);
    await store.syncOccurrences(context, nextWeekRange, onChange);
    store.stopOccurrences();

    expect(subscribeOccurrences).toHaveBeenCalledTimes(2);
    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

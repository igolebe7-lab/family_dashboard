import { describe, expect, it, vi } from 'vitest';

import { createRealtimeStore } from './realtime.store';

describe('realtime store lifecycle', () => {
  const context = { familyId: 'family_1', memberId: 'member_mom' };

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

import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';

describe('child points state', () => {
  it('does not show a late balance after profile switch or logout', async () => {
    const { createPointsState } = await import('./points.store');
    let finish!: (value: Record<string, number>) => void;
    const state = createPointsState(() => new Promise(resolve => { finish = resolve; }));
    const loading = state.setContext({ familyId: 'f', memberId: 'parent' });
    await state.setContext(null); finish({ child: 99 }); await loading;
    expect(get(state).balances).toEqual({});
    expect(get(state).loading).toBe(false);
  });
  it('clears stale balance after a failed revalidation and allows retry', async () => {
    const { createPointsState } = await import('./points.store');
    let fail = false;
    const state = createPointsState(async () => { if (fail) throw new Error('Offline'); return { child: 5 }; });
    await state.setContext({ familyId: 'f', memberId: 'parent' }); expect(get(state).balances).toEqual({ child: 5 });
    fail = true; await state.reload(); expect(get(state).balances).toEqual({}); expect(get(state).error).toBeTruthy();
    fail = false; await state.reload(); expect(get(state).balances).toEqual({ child: 5 }); expect(get(state).error).toBeNull();
    state.destroy();
  });
});

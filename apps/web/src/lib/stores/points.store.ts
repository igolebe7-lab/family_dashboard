import { readable, writable } from 'svelte/store';
import { getPointsBalances } from '$lib/api/work-features.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { familyStore, getActiveFamilyContext } from './family.store';
import { createRealtimeStore } from './realtime.store';

type PointsState = { balances: Record<string, number>; loading: boolean; error: string | null };
const empty = (): PointsState => ({ balances: {}, loading: false, error: null });

export function createPointsState(load = getPointsBalances) {
  const store = writable(empty());
  let context: ActiveFamilyContext | null = null, epoch = 0, disposed = false;
  async function reload() {
    if (!context || disposed) return;
    const version = ++epoch, active = context;
    store.set({ ...empty(), loading: true });
    try {
      const balances = await load(active);
      if (!disposed && version === epoch) store.set({ balances, loading: false, error: null });
    } catch {
      if (!disposed && version === epoch) store.set({ ...empty(), error: 'Не удалось обновить детский баланс.' });
    }
  }
  async function setContext(next: ActiveFamilyContext | null) {
    if (next?.familyId === context?.familyId && next?.memberId === context?.memberId) return;
    epoch++; context = next; store.set(empty());
    if (next) await reload();
  }
  return { subscribe: store.subscribe, reload, setContext, destroy() { disposed = true; epoch++; context = null; store.set(empty()); } };
}

let activeState: ReturnType<typeof createPointsState> | undefined;
export function refreshPoints() { return activeState?.reload(); }

// One request/subscription per active family profile, even with multiple visible child cards.
export const pointsStore = readable(empty(), set => {
  if (typeof window === 'undefined') return;
  const state = createPointsState(), realtime = createRealtimeStore();
  activeState = state;
  const unsubscribeState = state.subscribe(set);
  const unsubscribeFamily = familyStore.subscribe(family => {
    const context = getActiveFamilyContext(family);
    void state.setContext(context);
    if (!context) { realtime.stopAll(); return; }
    void Promise.all([
      realtime.syncActivity(context, () => void state.reload()),
      realtime.syncFamilyChanges(context, () => void state.reload()),
      realtime.syncRecovery(context, () => void state.reload())
    ]).catch(error => console.warn('Points realtime unavailable.', error));
  });
  const refresh = () => { void state.reload(); };
  const foreground = () => { if (!document.hidden) refresh(); };
  window.addEventListener('online', refresh); document.addEventListener('visibilitychange', foreground);
  return () => {
    unsubscribeFamily(); unsubscribeState(); state.destroy(); realtime.stopAll();
    if (activeState === state) activeState = undefined;
    window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', foreground);
  };
});

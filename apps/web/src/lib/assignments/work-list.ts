import { writable } from 'svelte/store';
import { approveOccurrence, markOccurrenceDone, rejectOccurrence } from '$lib/api/occurrences.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { FamilyState } from '$lib/stores/family.store';
import type { ItemOccurrence } from '$lib/types/domain';
import { canViewItem } from '$lib/utils/permissions';
import { createAssignmentViewModels, createChildModeViewModel, createTaskViewModels, type AssignmentAction } from './assignments-view';
import { loadWorkRecords, type WorkMode, type WorkRecords } from './work-records';

export type WorkListState = WorkRecords & {
  context: ActiveFamilyContext | null;
  family: FamilyState | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  actionError: string | null;
  message: string | null;
  busyId: string | null;
};
type Dependencies = {
  load: typeof loadWorkRecords;
  mutate: (action: AssignmentAction, id: string, context: ActiveFamilyContext, reason?: string) => Promise<ItemOccurrence>;
};

const empty = (): WorkListState => ({ occurrences: [], items: [], context: null, family: null, loading: false, loaded: false, error: null, actionError: null, message: null, busyId: null });

export function createWorkList(mode: WorkMode, dependencies: Partial<Dependencies> = {}) {
  const load = dependencies.load ?? loadWorkRecords;
  const mutate = dependencies.mutate ?? ((action, id, context, reason) => action === 'approve_assignment' ? approveOccurrence(id, context) : action === 'reject_assignment' ? rejectOccurrence(id, context, reason) : markOccurrenceDone(id, context));
  let state = empty();
  const store = writable(state);
  let generation = 0;
  let request = 0;
  let controller: AbortController | undefined;
  let disposed = false;
  function publish(patch: Partial<WorkListState>) { state = { ...state, ...patch }; store.set(state); }

  async function reload(): Promise<void> {
    if (!state.context || disposed || state.busyId) return;
    const context = state.context;
    const identity = generation;
    const ticket = ++request;
    controller?.abort(); controller = new AbortController();
    publish({ loading: true, error: null });
    try {
      const result = await load(context, mode, controller.signal);
      if (disposed || identity !== generation || ticket !== request) return;
      const actor = state.family?.activeMember;
      const visibleItems = result.items.filter((item) => actor && canViewItem(actor, item, state.family?.members));
      const itemIds = new Set(visibleItems.map((item) => item.id));
      publish({ items: visibleItems, occurrences: result.occurrences.filter((occurrence) => occurrence.family === context.familyId && itemIds.has(occurrence.item)), loaded: true });
    } catch {
      if (!disposed && identity === generation && ticket === request) publish({ error: state.loaded ? 'Не удалось обновить список. Показаны ранее загруженные данные.' : 'Не удалось загрузить список. Проверьте подключение.' });
    } finally {
      if (!disposed && identity === generation && ticket === request) publish({ loading: false });
    }
  }

  async function setFamily(family: FamilyState): Promise<void> {
    if (disposed) return;
    const actor = family.activeMember;
    const ready = family.status === 'ready' && actor?.active && actor.family === family.activeFamily?.id && (mode !== 'child' || ['child', 'teen'].includes(actor.role));
    const context = ready && actor && family.activeFamily ? { familyId: family.activeFamily.id, memberId: actor.id } : null;
    const changed = context?.familyId !== state.context?.familyId || context?.memberId !== state.context?.memberId;
    if (changed || !context) {
      generation += 1; request += 1; controller?.abort();
      state = empty(); publish({ family, context });
    } else publish({ family });
    if (context && (changed || !state.loaded && !state.loading)) await reload();
  }

  async function act(action: AssignmentAction, id: string, reason?: string): Promise<void> {
    if (!state.context || state.busyId || state.loading || state.error || disposed) return;
    const input = { ...state, members: state.family?.members ?? [], activeMemberId: state.context.memberId, timezone: state.family?.activeFamily?.timezone };
    const cards = mode === 'child' ? createChildModeViewModel(input).assignmentCards : mode === 'task' ? createTaskViewModels(input) : createAssignmentViewModels(input);
    const card = cards.find((entry) => entry.id === id);
    if (!card || (card.primaryAction !== action && card.secondaryAction !== action)) return;
    const context = state.context; const identity = generation;
    // An older refresh must not overwrite the successful mutation.
    request += 1; controller?.abort();
    publish({ busyId: id, actionError: null, message: null });
    try {
      const updated = await mutate(action, id, context, reason);
      if (disposed || generation !== identity) return;
      if (updated.family !== context.familyId || updated.id !== id || updated.item !== card.itemId) throw new Error('Unexpected work record');
      publish({ occurrences: state.occurrences.map((entry) => entry.id === id ? updated : entry), message: action === 'approve_assignment' ? 'Поручение подтверждено.' : action === 'reject_assignment' ? 'Поручение возвращено на доработку.' : state.items.find((item) => item.id === card.itemId)?.approvalRequired ? 'Готово. Ожидает проверки.' : 'Готово.' });
    } catch {
      if (!disposed && generation === identity) publish({ actionError: 'Не удалось сохранить изменение. Попробуйте ещё раз.' });
    } finally {
      if (!disposed && generation === identity) publish({ busyId: null });
    }
  }

  return { subscribe: store.subscribe, setFamily, reload, act, destroy() { disposed = true; generation += 1; controller?.abort(); } };
}

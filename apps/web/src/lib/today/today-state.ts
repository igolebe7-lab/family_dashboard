import { writable } from 'svelte/store';
import { listActivity } from '$lib/api/activity.api';
import { listUnreadNotifications } from '$lib/api/notifications.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { listOccurrencesInRange } from '$lib/api/occurrences.api';
import type { TodayNavigationView } from '$lib/calendar/today-navigation';
import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';
import { getDateTimeFormatter } from '$lib/utils/date-format';
import { createTodayViewModelFromOccurrences, getTodayOccurrenceRange, loadTodayViewModelFromOccurrences } from './today-data';
import { createTodayViewModel, type TodayFeedItem, type TodayViewModel } from './today-view-model';

type TodayInput = { context: ActiveFamilyContext; date: Date; view: TodayNavigationView; members: FamilyMember[]; timezone?: string };
type TodayState = {
  model: TodayViewModel;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  feedItems: TodayFeedItem[];
  feedError: string | null;
  notificationCount: number;
  notificationError: string | null;
};

export function createTodayState(dependencies: {
  loadToday?: typeof loadTodayViewModelFromOccurrences;
  listOccurrences?: typeof listOccurrencesInRange;
  listActivity?: typeof listActivity;
  listNotifications?: typeof listUnreadNotifications;
} = {}) {
  let generation = 0;
  let occurrenceRequest = 0;
  let feedRequest = 0;
  let notificationRequest = 0;
  let input: TodayInput | null = null;
  let scopeKey: string | null = null;
  let cache: { key: string; rows: ItemOccurrence[]; loadedAt: number } | null = null;
  let loadingRangeKey: string | null = null;
  const scope = (next: TodayInput) => JSON.stringify([next.context, next.timezone, next.members]);
  const rangeKey = (next: TodayInput) => JSON.stringify([scope(next), getTodayOccurrenceRange(next.date, next.view, next.timezone)]);
  const project = (next: TodayInput, rows: ItemOccurrence[]) => createTodayViewModelFromOccurrences({
    ...next, activeMemberId: next.context.memberId, occurrences: rows
  });
  const empty = (date = new Date()): TodayState => ({
    model: createTodayViewModel(date), status: 'idle', error: null,
    feedItems: [], feedError: null, notificationCount: 0, notificationError: null
  });
  const store = writable(empty());

  async function refreshOccurrences() {
    if (!input) return;
    const captured = input;
    const capturedKey = rangeKey(captured);
    const epoch = generation;
    const request = ++occurrenceRequest;
    loadingRangeKey = capturedKey;
    const current = () => epoch === generation && request === occurrenceRequest;
    store.update((state) => ({ ...state, status: 'loading', error: null }));
    try {
      let model: TodayViewModel;
      if (dependencies.loadToday) model = await dependencies.loadToday(captured.context, captured);
      else {
        const result = await (dependencies.listOccurrences ?? listOccurrencesInRange)(captured.context,
          getTodayOccurrenceRange(captured.date, captured.view, captured.timezone));
        model = project(current() && input && rangeKey(input) === capturedKey ? input : captured, result.items);
        if (current()) cache = { key: capturedKey, rows: result.items, loadedAt: Date.now() };
      }
      if (current()) store.update((state) => ({ ...state, model, status: 'ready' }));
    } catch {
      if (current()) {
        cache = null;
        store.update((state) => ({ ...state, status: 'error', error: 'Не удалось загрузить расписание. Проверьте подключение и попробуйте ещё раз.' }));
      }
    } finally { if (current()) loadingRangeKey = null; }
  }

  async function refreshActivity() {
    if (!input) return;
    const captured = input;
    const epoch = generation;
    const request = ++feedRequest;
    try {
      const records = await (dependencies.listActivity ?? listActivity)(captured.context, 8);
      if (epoch !== generation || request !== feedRequest) return;
      const feedItems = records.map((record): TodayFeedItem => ({
        id: record.id,
        actor: captured.members.find((member) => member.id === record.actor)?.displayName ?? 'Семья',
        body: record.summary,
        timeLabel: Number.isFinite(Date.parse(record.created))
          ? getDateTimeFormatter('ru-RU', { timeZone: captured.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(record.created)) : '',
        icon: record.action === 'assignment.approved' ? 'badge-check' : record.action === 'assignment.rejected' ? 'rotate-ccw' : 'message-square-text',
        color: record.action === 'assignment.approved' ? 'green' : record.action === 'assignment.rejected' ? 'peach' : 'blue'
      }));
      store.update((state) => ({ ...state, feedItems, feedError: null }));
    } catch {
      if (epoch === generation && request === feedRequest) store.update((state) => ({ ...state, feedError: 'Не удалось загрузить семейную ленту.' }));
    }
  }

  async function refreshNotifications() {
    if (!input) return;
    const captured = input;
    const epoch = generation;
    const request = ++notificationRequest;
    try {
      const records = await (dependencies.listNotifications ?? listUnreadNotifications)(captured.context);
      if (epoch === generation && request === notificationRequest) store.update((state) => ({ ...state, notificationCount: records.length, notificationError: null }));
    } catch {
      if (epoch === generation && request === notificationRequest) store.update((state) => ({ ...state, notificationError: 'Не удалось проверить уведомления.' }));
    }
  }

  const refresh = () => Promise.all([refreshOccurrences(), refreshActivity(), refreshNotifications()]);
  return {
    subscribe: store.subscribe,
    refresh, refreshOccurrences, refreshActivity, refreshNotifications,
    invalidate() {
      generation++; cache = null; loadingRangeKey = null;
      if (input) store.set(empty(input.date));
    },
    reset(date?: Date) { generation++; input = null; scopeKey = null; cache = null; loadingRangeKey = null; store.set(empty(date)); },
    load(next: TodayInput) {
      const nextScope = scope(next);
      const changedScope = scopeKey !== nextScope;
      if (changedScope) { generation++; cache = null; loadingRangeKey = null; scopeKey = nextScope; }
      input = next;
      if (changedScope) store.set(empty(next.date));
      if (cache?.key === rangeKey(next) && Date.now() - cache.loadedAt < 60000) {
        // Keep an in-flight refresh of this week authoritative after a day/view change.
        if (loadingRangeKey !== cache.key) { occurrenceRequest++; loadingRangeKey = null; }
        const model = project(next, cache.rows);
        store.update(state => ({ ...state, model, status: 'ready', error: null }));
        return Promise.resolve();
      }
      if (!changedScope) store.update(state => ({ ...state, model: createTodayViewModel(next.date) }));
      return changedScope ? refresh() : refreshOccurrences();
    }
  };
}

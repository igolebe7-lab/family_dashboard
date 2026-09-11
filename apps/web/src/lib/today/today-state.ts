import { writable } from 'svelte/store';
import { listActivity } from '$lib/api/activity.api';
import { listUnreadNotifications } from '$lib/api/notifications.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { TodayNavigationView } from '$lib/calendar/today-navigation';
import type { FamilyMember } from '$lib/types/domain';
import { loadTodayViewModelFromOccurrences } from './today-data';
import { createTodayViewModel, type TodayFeedItem, type TodayViewModel } from './today-view-model';

type TodayInput = { context: ActiveFamilyContext; date: Date; view: TodayNavigationView; members: FamilyMember[] };
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
  listActivity?: typeof listActivity;
  listNotifications?: typeof listUnreadNotifications;
} = {}) {
  let generation = 0;
  let occurrenceRequest = 0;
  let feedRequest = 0;
  let notificationRequest = 0;
  let input: TodayInput | null = null;
  const empty = (date = new Date()): TodayState => ({
    model: createTodayViewModel(date), status: 'idle', error: null,
    feedItems: [], feedError: null, notificationCount: 0, notificationError: null
  });
  const store = writable(empty());

  async function refreshOccurrences() {
    if (!input) return;
    const captured = input;
    const epoch = generation;
    const request = ++occurrenceRequest;
    const current = () => epoch === generation && request === occurrenceRequest;
    store.update((state) => ({ ...state, status: 'loading', error: null }));
    try {
      const model = await (dependencies.loadToday ?? loadTodayViewModelFromOccurrences)(captured.context, captured);
      if (current()) store.update((state) => ({ ...state, model, status: 'ready' }));
    } catch {
      if (current()) store.update((state) => ({ ...state, status: 'error', error: 'Не удалось загрузить расписание. Проверьте подключение и попробуйте ещё раз.' }));
    }
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
          ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(record.created)) : '',
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
    reset(date?: Date) { generation++; input = null; store.set(empty(date)); },
    load(next: TodayInput) {
      generation++;
      input = next;
      store.set(empty(next.date));
      return refresh();
    }
  };
}

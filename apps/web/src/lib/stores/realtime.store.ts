import { subscribeActivity } from '$lib/api/activity.api';
import { subscribeFamilyChanges } from '$lib/api/families.api';
import { subscribeReconnect } from '$lib/api/realtime-recovery.api';
import { subscribeNotifications } from '$lib/api/notifications.api';
import { subscribeDayAnnotations } from '$lib/api/day-annotations.api';
import {
  subscribeOccurrencesInRange,
  type OccurrenceRange
} from '$lib/api/occurrences.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';

type RealtimeUnsubscribe = () => void | Promise<void>;
type RealtimeSubscribe = (notify: () => void) => Promise<RealtimeUnsubscribe>;

function releaseSubscription(unsubscribe: RealtimeUnsubscribe | null): void {
  if (!unsubscribe) return;
  // SDK detaches local listeners immediately, then submits the remaining topics remotely.
  try {
    void Promise.resolve(unsubscribe()).catch(error => console.warn('Realtime subscription cleanup failed.', error));
  } catch (error) {
    console.warn('Realtime subscription cleanup failed.', error);
  }
}

export type RealtimeStoreDependencies = {
  subscribeDayAnnotations?: typeof subscribeDayAnnotations;
  subscribeFamilyChanges?: typeof subscribeFamilyChanges;
  subscribeReconnect?: typeof subscribeReconnect;
  subscribeNotifications?: (
    context: ActiveFamilyContext,
    onChange: () => void
  ) => Promise<RealtimeUnsubscribe>;
  subscribeActivity?: (
    context: ActiveFamilyContext,
    onChange: () => void
  ) => Promise<RealtimeUnsubscribe>;
  subscribeOccurrences?: (
    context: ActiveFamilyContext,
    range: OccurrenceRange,
    onChange: () => void
  ) => Promise<RealtimeUnsubscribe>;
};

export function createRealtimeStore(dependencies: RealtimeStoreDependencies = {}) {
  const subscribeNotificationsDependency =
    dependencies.subscribeNotifications ?? subscribeNotifications;
  const subscribeActivityDependency = dependencies.subscribeActivity ?? subscribeActivity;
  const subscribeOccurrencesDependency =
    dependencies.subscribeOccurrences ?? subscribeOccurrencesInRange;

  function channel() {
    let key: string | null = null;
    let generation = 0;
    let unsubscribe: RealtimeUnsubscribe | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let callback: () => void = () => {};
    let pending: Promise<void> | undefined;
    function stop() {
      generation++;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      releaseSubscription(unsubscribe);
      unsubscribe = null;
      key = null;
      pending = undefined;
    }
    function sync(nextKey: string, subscribe: RealtimeSubscribe, onChange: () => void): Promise<void> {
      callback = onChange;
      if (key === nextKey) return pending ?? Promise.resolve();
      stop();
      key = nextKey;
      const epoch = generation;
      const notify = () => {
        if (epoch !== generation || timer !== undefined) return;
        // One refresh per burst, with bounded latency even during a long stream.
        timer = setTimeout(() => {
          timer = undefined;
          if (epoch === generation) callback();
        }, 120);
      };
      pending = subscribe(notify).then(next => {
        if (epoch !== generation) releaseSubscription(next);
        else { unsubscribe = next; pending = undefined; }
      }).catch(error => {
        if (epoch === generation) stop();
        throw error;
      });
      return pending;
    }
    return { sync, stop };
  }
  const notifications = channel(), activity = channel(), occurrences = channel(), family = channel(), recovery = channel(), annotations = channel();

  return {
    syncDayAnnotations: (context: ActiveFamilyContext, onChange: () => void) => annotations.sync(
      `${context.familyId}:${context.memberId}`, notify => (dependencies.subscribeDayAnnotations ?? subscribeDayAnnotations)(context, notify), onChange),
    syncFamilyChanges: (context: ActiveFamilyContext, onChange: () => void) => family.sync(
      `${context.familyId}:${context.memberId}`, notify => (dependencies.subscribeFamilyChanges ?? subscribeFamilyChanges)(context, notify), onChange),
    syncRecovery: (context: ActiveFamilyContext, onReconnect: () => void) => recovery.sync(
      `${context.familyId}:${context.memberId}`, notify => (dependencies.subscribeReconnect ?? subscribeReconnect)(notify), onReconnect),
    syncNotifications: (context: ActiveFamilyContext, onChange: () => void) =>
      notifications.sync(
        `${context.familyId}:${context.memberId}`,
        notify => subscribeNotificationsDependency(context, notify), onChange
      ),
    syncActivity: (context: ActiveFamilyContext, onChange: () => void) =>
      activity.sync(
        `${context.familyId}:${context.memberId}`,
        notify => subscribeActivityDependency(context, notify), onChange
      ),
    syncOccurrences: (
      context: ActiveFamilyContext,
      range: OccurrenceRange,
      onChange: () => void
    ) =>
      occurrences.sync(
        `${context.familyId}:${context.memberId}:${range.from}:${range.to}`,
        notify => subscribeOccurrencesDependency(context, range, notify), onChange
      ),
    stopNotifications: notifications.stop,
    stopActivity: activity.stop,
    stopOccurrences: occurrences.stop,
    stopAll: () => {
      notifications.stop(); activity.stop(); occurrences.stop(); family.stop(); recovery.stop(); annotations.stop();
    }
  };
}

export const realtimeStore = createRealtimeStore();

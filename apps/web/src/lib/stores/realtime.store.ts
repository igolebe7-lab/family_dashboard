import { subscribeActivity } from '$lib/api/activity.api';
import { subscribeNotifications } from '$lib/api/notifications.api';
import {
  subscribeOccurrencesInRange,
  type OccurrenceRange
} from '$lib/api/occurrences.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';

type RealtimeUnsubscribe = () => void | Promise<void>;
type RealtimeSubscribe = () => Promise<RealtimeUnsubscribe>;

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

  let notificationKey: string | null = null;
  let notificationUnsubscribe: RealtimeUnsubscribe | null = null;
  let activityKey: string | null = null;
  let activityUnsubscribe: RealtimeUnsubscribe | null = null;
  let occurrencesKey: string | null = null;
  let occurrencesUnsubscribe: RealtimeUnsubscribe | null = null;

  async function sync(
    nextKey: string,
    currentKey: string | null,
    unsubscribe: RealtimeUnsubscribe | null,
    subscribe: RealtimeSubscribe,
    setState: (key: string, unsubscribe: RealtimeUnsubscribe) => void
  ): Promise<void> {
    if (currentKey === nextKey) return;
    releaseSubscription(unsubscribe);
    const nextUnsubscribe = await subscribe();
    setState(nextKey, nextUnsubscribe);
  }

  return {
    syncNotifications: (context: ActiveFamilyContext, onChange: () => void) =>
      sync(
        `${context.familyId}:${context.memberId}`,
        notificationKey,
        notificationUnsubscribe,
        () => subscribeNotificationsDependency(context, onChange),
        (key, unsubscribe) => {
          notificationKey = key;
          notificationUnsubscribe = unsubscribe;
        }
      ),
    syncActivity: (context: ActiveFamilyContext, onChange: () => void) =>
      sync(
        context.familyId,
        activityKey,
        activityUnsubscribe,
        () => subscribeActivityDependency(context, onChange),
        (key, unsubscribe) => {
          activityKey = key;
          activityUnsubscribe = unsubscribe;
        }
      ),
    syncOccurrences: (
      context: ActiveFamilyContext,
      range: OccurrenceRange,
      onChange: () => void
    ) =>
      sync(
        `${context.familyId}:${context.memberId}:${range.from}:${range.to}`,
        occurrencesKey,
        occurrencesUnsubscribe,
        () => subscribeOccurrencesDependency(context, range, onChange),
        (key, unsubscribe) => {
          occurrencesKey = key;
          occurrencesUnsubscribe = unsubscribe;
        }
      ),
    stopNotifications: () => {
      releaseSubscription(notificationUnsubscribe);
      notificationUnsubscribe = null;
      notificationKey = null;
    },
    stopActivity: () => {
      releaseSubscription(activityUnsubscribe);
      activityUnsubscribe = null;
      activityKey = null;
    },
    stopOccurrences: () => {
      releaseSubscription(occurrencesUnsubscribe);
      occurrencesUnsubscribe = null;
      occurrencesKey = null;
    },
    stopAll: () => {
      releaseSubscription(notificationUnsubscribe);
      releaseSubscription(activityUnsubscribe);
      releaseSubscription(occurrencesUnsubscribe);
      notificationUnsubscribe = null;
      activityUnsubscribe = null;
      occurrencesUnsubscribe = null;
      notificationKey = null;
      activityKey = null;
      occurrencesKey = null;
    }
  };
}

export const realtimeStore = createRealtimeStore();

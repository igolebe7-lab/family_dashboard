import { COLLECTIONS } from '$lib/constants/collections';
import type { ActivityRecord } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asRecord,
  asString,
  escapeFilterValue,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export async function listActivity(
  context: Partial<ActiveFamilyContext>,
  limit = 30,
  page = 1
): Promise<ActivityRecord[]> {
  const activeContext = requireActiveContext(context);
  const activity = getPocketBaseClient().collection(COLLECTIONS.itemActivity);
  const getList = requireCollectionMethod(activity, 'getList');
  const result = asRecord(
    await getList(Math.max(1, Math.trunc(page) || 1), Math.min(100, Math.max(1, Math.trunc(limit) || 30)), {
      filter: `family = "${escapeFilterValue(activeContext.familyId)}"`,
      sort: '-created',
      requestKey: null,
      ...memberRequestOptions(activeContext)
    })
  );

  return Array.isArray(result.items) ? result.items.map(mapActivityRecord) : [];
}

export async function subscribeActivity(
  context: Partial<ActiveFamilyContext>,
  onChange: () => void
): Promise<() => void> {
  const activeContext = requireActiveContext(context);
  const activity = getPocketBaseClient().collection(COLLECTIONS.itemActivity);
  const subscribe = requireCollectionMethod(activity, 'subscribe');

  return subscribe(
    '*',
    () => onChange(),
    {
      filter: `family = "${escapeFilterValue(activeContext.familyId)}"`,
      ...memberRequestOptions(activeContext)
    }
  );
}

export function mapActivityRecord(value: unknown): ActivityRecord {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    item: asString(record.item) || undefined,
    occurrence: asString(record.occurrence) || undefined,
    actor: asString(record.actor),
    action: asString(record.action) as ActivityRecord['action'],
    summary: asString(record.summary),
    created: asString(record.created)
  };
}

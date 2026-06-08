import { COLLECTIONS } from '$lib/constants/collections';
import type { ActivityRecord } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asRecord,
  asString,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export async function listActivity(
  context: Partial<ActiveFamilyContext>,
  limit = 30
): Promise<ActivityRecord[]> {
  const activeContext = requireActiveContext(context);
  const activity = getPocketBaseClient().collection(COLLECTIONS.itemActivity);
  const getList = requireCollectionMethod(activity, 'getList');
  const result = asRecord(
    await getList(1, limit, {
      filter: `family = "${activeContext.familyId}"`,
      sort: '-created',
      ...memberRequestOptions(activeContext)
    })
  );

  return Array.isArray(result.items) ? result.items.map(mapActivityRecord) : [];
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

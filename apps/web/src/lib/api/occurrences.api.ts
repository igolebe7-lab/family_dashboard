import { COLLECTIONS } from '$lib/constants/collections';
import type { ItemOccurrence } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  escapeFilterValue,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export type OccurrenceRange = {
  from: string;
  to: string;
};

export type OccurrenceListResult = {
  items: ItemOccurrence[];
  totalItems: number;
};

export async function listOccurrencesInRange(
  context: Partial<ActiveFamilyContext>,
  range: OccurrenceRange
): Promise<OccurrenceListResult> {
  const activeContext = requireActiveContext(context);
  const occurrences = getPocketBaseClient().collection(COLLECTIONS.itemOccurrences);
  const getList = requireCollectionMethod(occurrences, 'getList');
  const result = asRecord(
    await getList(1, 200, {
      filter: buildOccurrenceRangeFilter(activeContext.familyId, range),
      sort: 'start_at,due_at',
      requestKey: null,
      ...memberRequestOptions(activeContext)
    })
  );

  return {
    items: Array.isArray(result.items) ? result.items.map(mapOccurrenceRecord) : [],
    totalItems: typeof result.totalItems === 'number' ? result.totalItems : 0
  };
}

export function buildOccurrenceRangeFilter(familyId: string, range: OccurrenceRange): string {
  const family = escapeFilterValue(familyId);
  const from = escapeFilterValue(range.from);
  const to = escapeFilterValue(range.to);

  return [
    `family = "${family}"`,
    [
      '(',
      `start_at != "" && start_at < "${to}" && (end_at = "" || end_at >= "${from}")`,
      ')',
      '||',
      '(',
      `due_at != "" && due_at >= "${from}" && due_at < "${to}"`,
      ')'
    ].join(' ')
  ].join(' && ');
}

export function mapOccurrenceRecord(value: unknown): ItemOccurrence {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    item: asString(record.item),
    visibleTo: asStringArray(record.visible_to),
    kind: asString(record.kind) as ItemOccurrence['kind'],
    titleSnapshot: asString(record.title_snapshot),
    categorySnapshot: asString(record.category_snapshot) as ItemOccurrence['categorySnapshot'],
    startAt: asString(record.start_at) || undefined,
    endAt: asString(record.end_at) || undefined,
    dueAt: asString(record.due_at) || undefined,
    allDay: asBoolean(record.all_day),
    status: asString(record.status) as ItemOccurrence['status'],
    completedBy: asString(record.completed_by) || undefined,
    completedAt: asString(record.completed_at) || undefined,
    approvedBy: asString(record.approved_by) || undefined,
    approvedAt: asString(record.approved_at) || undefined,
    rejectedBy: asString(record.rejected_by) || undefined,
    rejectedAt: asString(record.rejected_at) || undefined,
    rejectionReason: asString(record.rejection_reason) || undefined
  };
}

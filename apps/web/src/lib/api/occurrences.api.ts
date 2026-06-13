import { COLLECTIONS } from '$lib/constants/collections';
import type { ItemKind, ItemOccurrence } from '$lib/types/domain';

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

export type OccurrenceMarker = {
  id: string;
  kind: Extract<ItemKind, 'event' | 'task' | 'assignment'>;
  startAt?: string;
  dueAt?: string;
};

export type OccurrenceMarkerListResult = {
  items: OccurrenceMarker[];
  totalItems: number;
};

export type OccurrenceMarkerListOptions = {
  perPage?: number;
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

export async function listOccurrenceMarkersInRange(
  context: Partial<ActiveFamilyContext>,
  range: OccurrenceRange,
  options: OccurrenceMarkerListOptions = {}
): Promise<OccurrenceMarkerListResult> {
  const activeContext = requireActiveContext(context);
  const occurrences = getPocketBaseClient().collection(COLLECTIONS.itemOccurrences);
  const getList = requireCollectionMethod(occurrences, 'getList');
  const perPage = options.perPage ?? 200;
  const items: OccurrenceMarker[] = [];
  let totalItems = 0;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = asRecord(
      await getList(page, perPage, {
        fields: 'id,kind,start_at,due_at',
        filter: buildOccurrenceRangeFilter(activeContext.familyId, range, {
          kinds: ['event', 'task', 'assignment']
        }),
        sort: 'start_at,due_at',
        requestKey: null,
        ...memberRequestOptions(activeContext)
      })
    );

    if (page === 1) {
      totalItems = typeof result.totalItems === 'number' ? result.totalItems : 0;
      totalPages = typeof result.totalPages === 'number' && result.totalPages > 0 ? result.totalPages : 1;
    }

    if (Array.isArray(result.items)) {
      items.push(...result.items.map(mapOccurrenceMarkerRecord));
    }

    page += 1;
  }

  return {
    items,
    totalItems
  };
}

export async function markOccurrenceDone(
  id: string,
  context: Partial<ActiveFamilyContext>
): Promise<ItemOccurrence> {
  return updateOccurrenceStatus(id, { status: 'done' }, context);
}

export async function approveOccurrence(
  id: string,
  context: Partial<ActiveFamilyContext>
): Promise<ItemOccurrence> {
  return updateOccurrenceStatus(id, { status: 'approved' }, context);
}

export async function rejectOccurrence(
  id: string,
  context: Partial<ActiveFamilyContext>,
  reason?: string
): Promise<ItemOccurrence> {
  return updateOccurrenceStatus(
    id,
    {
      status: 'rejected',
      rejectionReason: reason
    },
    context
  );
}

export async function updateOccurrenceStatus(
  id: string,
  input: { status: ItemOccurrence['status']; rejectionReason?: string },
  context: Partial<ActiveFamilyContext>
): Promise<ItemOccurrence> {
  const activeContext = requireActiveContext(context);
  const occurrences = getPocketBaseClient().collection(COLLECTIONS.itemOccurrences);
  const update = requireCollectionMethod(occurrences, 'update');
  const body: Record<string, unknown> = { status: input.status };

  if (input.rejectionReason !== undefined) {
    body.rejection_reason = input.rejectionReason;
  }

  return mapOccurrenceRecord(await update(id, body, memberRequestOptions(activeContext)));
}

export function buildOccurrenceRangeFilter(
  familyId: string,
  range: OccurrenceRange,
  options: { kinds?: Extract<ItemKind, 'event' | 'task' | 'assignment'>[] } = {}
): string {
  const family = escapeFilterValue(familyId);
  const from = escapeFilterValue(range.from);
  const to = escapeFilterValue(range.to);
  const conditions = [
    `family = "${family}"`,
    [
      '(',
      '(',
      `start_at != "" && start_at < "${to}" && (end_at = "" || end_at >= "${from}")`,
      ')',
      '||',
      '(',
      `due_at != "" && due_at >= "${from}" && due_at < "${to}"`,
      ')',
      ')'
    ].join(' ')
  ];

  if (options.kinds?.length) {
    conditions.push(
      `(${options.kinds.map((kind) => `kind = "${escapeFilterValue(kind)}"`).join(' || ')})`
    );
  }

  return conditions.join(' && ');
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

export function mapOccurrenceMarkerRecord(value: unknown): OccurrenceMarker {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    kind: asString(record.kind) as OccurrenceMarker['kind'],
    startAt: asString(record.start_at) || undefined,
    dueAt: asString(record.due_at) || undefined
  };
}

import { COLLECTIONS } from '$lib/constants/collections';
import type { ItemKind, ItemOccurrence } from '$lib/types/domain';
import { mapItemRecord } from './items.api';
import { ensureOccurrenceRange } from './recurrence.api';

import {
  type ActiveFamilyContext,
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  escapeFilterValue,
  getPocketBaseClient,
  memberRequestOptions,
  pocketBaseFilterDate,
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
  family?: string;
  memberIds?: string[];
  allDay?: boolean;
  timezone?: string;
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

function allDayEnvelope(range: OccurrenceRange): OccurrenceRange {
  const padding = 36 * 3600000;
  // A civil all-day date may fall outside the viewer's UTC day. Keep this
  // bounded envelope within the backend's 370-day materialization limit.
  if (Date.parse(range.to) - Date.parse(range.from) > 367 * 86400000) return range;
  return { from: new Date(Date.parse(range.from) - padding).toISOString(),
    to: new Date(Date.parse(range.to) + padding).toISOString() };
}

export async function listOccurrencesInRange(
  context: Partial<ActiveFamilyContext>,
  range: OccurrenceRange
): Promise<OccurrenceListResult> {
  const activeContext = requireActiveContext(context);
  await ensureOccurrenceRange(activeContext, allDayEnvelope(range));
  const occurrences = getPocketBaseClient().collection(COLLECTIONS.itemOccurrences);
  const getList = requireCollectionMethod(occurrences, 'getList');
  const items: ItemOccurrence[] = [];
  let totalItems = 0;
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const result = asRecord(await getList(page, 200, {
      filter: buildOccurrenceRangeFilter(activeContext.familyId, range),
      sort: 'start_at,due_at,id',
      expand: 'item',
      requestKey: null,
      ...memberRequestOptions(activeContext)
    }));
    if (page === 1) {
      totalItems = typeof result.totalItems === 'number' ? result.totalItems : 0;
      totalPages = typeof result.totalPages === 'number' && Number.isFinite(result.totalPages)
        ? Math.max(1, result.totalPages) : 1;
    }
    if (Array.isArray(result.items)) items.push(...result.items.map(mapOccurrenceRecord));
  }

  return {
    items: [...new Map(items.map((item) => [item.id, item])).values()],
    totalItems
  };
}

export async function listOccurrenceMarkersInRange(
  context: Partial<ActiveFamilyContext>,
  range: OccurrenceRange,
  options: OccurrenceMarkerListOptions = {}
): Promise<OccurrenceMarkerListResult> {
  const activeContext = requireActiveContext(context);
  await ensureOccurrenceRange(activeContext, allDayEnvelope(range));
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
        fields: 'id,family,item,kind,start_at,due_at,all_day,expand.item.id,expand.item.family,expand.item.kind,expand.item.owner,expand.item.created_by,expand.item.assignees,expand.item.participants,expand.item.timezone',
        expand: 'item',
        filter: buildOccurrenceRangeFilter(activeContext.familyId, range, {
          kinds: ['event', 'task', 'assignment']
        }),
        sort: 'start_at,due_at,id',
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
    items: [...new Map(items.map(item => [item.id, item])).values()],
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

export async function subscribeOccurrencesInRange(
  context: Partial<ActiveFamilyContext>,
  range: OccurrenceRange,
  onChange: () => void
): Promise<() => void> {
  const activeContext = requireActiveContext(context);
  const occurrences = getPocketBaseClient().collection(COLLECTIONS.itemOccurrences);
  const subscribe = requireCollectionMethod(occurrences, 'subscribe');

  return subscribe(
    '*',
    () => onChange(),
    {
      filter: buildOccurrenceRangeFilter(activeContext.familyId, range),
      ...memberRequestOptions(activeContext)
    }
  );
}

export function buildOccurrenceRangeFilter(
  familyId: string,
  range: OccurrenceRange,
  options: { kinds?: Extract<ItemKind, 'event' | 'task' | 'assignment'>[] } = {}
): string {
  const family = escapeFilterValue(familyId);
  const from = pocketBaseFilterDate(range.from);
  const to = pocketBaseFilterDate(range.to);
  const envelope = allDayEnvelope(range);
  const conditions = [
    `family = "${family}"`,
    'item.archived = false',
    [
      '(',
      '(',
      `start_at != "" && start_at < "${to}" && (end_at = "" || end_at >= "${from}")`,
      ')',
      '||',
      '(',
      `due_at != "" && due_at >= "${from}" && due_at < "${to}"`,
      ')',
      '||',
      `(all_day = true && start_at >= "${pocketBaseFilterDate(envelope.from)}" && start_at < "${pocketBaseFilterDate(envelope.to)}")`,
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
  const expandedItem = asRecord(asRecord(record.expand).item);

  return {
    id: asString(record.id),
    updated: asString(record.updated) || undefined,
    family: asString(record.family),
    item: asString(record.item),
    itemRecord: expandedItem.id === record.item && expandedItem.family === record.family
      ? mapItemRecord(expandedItem) : undefined,
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
    rejectionReason: asString(record.rejection_reason) || undefined,
    checklistDoneIds: asStringArray(record.checklist_done_json)
  };
}

export function mapOccurrenceMarkerRecord(value: unknown): OccurrenceMarker {
  const record = asRecord(value);
  const item = asRecord(asRecord(record.expand).item);
  const matches = item.id === record.item && item.family === record.family && Boolean(record.family);
  const memberIds = !matches ? [] : item.kind === 'event' ? asStringArray(item.participants)
    : item.kind === 'assignment' ? asStringArray(item.assignees) : [asString(item.owner) || asString(item.created_by)].filter(Boolean);

  return {
    id: asString(record.id),
    family: asString(record.family),
    memberIds,
    allDay: asBoolean(record.all_day),
    timezone: matches ? asString(item.timezone) || undefined : undefined,
    kind: asString(record.kind) as OccurrenceMarker['kind'],
    startAt: asString(record.start_at) || undefined,
    dueAt: asString(record.due_at) || undefined
  };
}

import { COLLECTIONS } from '$lib/constants/collections';
import type { AccentColor } from '$lib/constants/colors';
import type { DayAnnotation } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asBoolean,
  asRecord,
  asString,
  escapeFilterValue,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export type DayAnnotationListResult = {
  items: DayAnnotation[];
  totalItems: number;
};

export async function listDayAnnotationsForYear(
  context: Partial<ActiveFamilyContext>,
  year: number
): Promise<DayAnnotationListResult> {
  const activeContext = requireActiveContext(context);
  const collection = getPocketBaseClient().collection(COLLECTIONS.dayAnnotations);
  const getList = requireCollectionMethod(collection, 'getList');
  const result = asRecord(
    await getList(1, 200, {
      filter: buildDayAnnotationsYearFilter(activeContext.familyId, year),
      sort: 'month,day,title',
      ...memberRequestOptions(activeContext)
    })
  );

  return {
    items: Array.isArray(result.items) ? result.items.map(mapDayAnnotationRecord) : [],
    totalItems: typeof result.totalItems === 'number' ? result.totalItems : 0
  };
}

export function buildDayAnnotationsYearFilter(familyId: string, year: number): string {
  const family = escapeFilterValue(familyId);

  return [
    `family = "${family}"`,
    [
      '(',
      'recurrence = "yearly"',
      ')',
      '||',
      '(',
      `recurrence = "one_time" && year = ${year}`,
      ')'
    ].join(' ')
  ].join(' && ');
}

export function mapDayAnnotationRecord(value: unknown): DayAnnotation {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    kind: asString(record.kind) as DayAnnotation['kind'],
    title: asString(record.title),
    description: asString(record.description) || undefined,
    month: asNumber(record.month),
    day: asNumber(record.day),
    year: asOptionalNumber(record.year),
    recurrence: asString(record.recurrence) as DayAnnotation['recurrence'],
    color: asString(record.color, 'gray') as AccentColor,
    tone: asString(record.tone, 'neutral') as DayAnnotation['tone'],
    visibility: asString(record.visibility, 'family') as DayAnnotation['visibility'],
    source: asString(record.source, 'manual') as DayAnnotation['source'],
    readonly: asBoolean(record.readonly),
    linkedMember: asString(record.linked_member) || undefined,
    personName: asString(record.person_name) || undefined,
    personRelation: asString(record.person_relation) || undefined,
    personContact: asString(record.person_contact) || undefined,
    countryCode: asString(record.country_code) || undefined,
    regionCode: asString(record.region_code) || undefined,
    sourceUid: asString(record.source_uid) || undefined,
    sourceHash: asString(record.source_hash) || undefined,
    fetchedAt: asString(record.fetched_at) || undefined,
    createdBy: asString(record.created_by) || undefined,
    created: asString(record.created) || undefined,
    updated: asString(record.updated) || undefined
  };
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

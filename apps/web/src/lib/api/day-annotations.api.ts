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

export type DayAnnotationInput = {
  kind: DayAnnotation['kind'];
  title: string;
  description?: string;
  month: number;
  day: number;
  year?: number;
  recurrence: DayAnnotation['recurrence'];
  color: DayAnnotation['color'];
  tone: DayAnnotation['tone'];
  visibility: DayAnnotation['visibility'];
  linkedMember?: string;
  personName?: string;
  personRelation?: string;
  personContact?: string;
};

export type DayAnnotationUpdateInput = Partial<DayAnnotationInput>;

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
      requestKey: null,
      ...memberRequestOptions(activeContext)
    })
  );

  return {
    items: Array.isArray(result.items) ? result.items.map(mapDayAnnotationRecord) : [],
    totalItems: typeof result.totalItems === 'number' ? result.totalItems : 0
  };
}

export async function createDayAnnotation(
  input: DayAnnotationInput,
  context: Partial<ActiveFamilyContext>
): Promise<DayAnnotation> {
  const activeContext = requireActiveContext(context);
  const collection = getPocketBaseClient().collection(COLLECTIONS.dayAnnotations);
  const create = requireCollectionMethod(collection, 'create');

  return mapDayAnnotationRecord(
    await create(
      {
        ...mapDayAnnotationInput(input),
        family: activeContext.familyId,
        created_by: activeContext.memberId,
        source: 'manual',
        readonly: false
      },
      memberRequestOptions(activeContext)
    )
  );
}

export async function updateDayAnnotation(
  id: string,
  input: DayAnnotationUpdateInput,
  context: Partial<ActiveFamilyContext>
): Promise<DayAnnotation> {
  const activeContext = requireActiveContext(context);
  const collection = getPocketBaseClient().collection(COLLECTIONS.dayAnnotations);
  const update = requireCollectionMethod(collection, 'update');

  return mapDayAnnotationRecord(
    await update(id, mapDayAnnotationInput(input), memberRequestOptions(activeContext))
  );
}

export async function deleteDayAnnotation(
  id: string,
  context: Partial<ActiveFamilyContext>
): Promise<void> {
  const activeContext = requireActiveContext(context);
  const collection = getPocketBaseClient().collection(COLLECTIONS.dayAnnotations);
  const remove = requireCollectionMethod(collection, 'delete');

  await remove(id, memberRequestOptions(activeContext));
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

function mapDayAnnotationInput(input: DayAnnotationUpdateInput): Record<string, unknown> {
  return omitUndefined({
    kind: input.kind,
    title: input.title,
    description: input.description,
    month: input.month,
    day: input.day,
    year: input.year,
    recurrence: input.recurrence,
    color: input.color,
    tone: input.tone,
    visibility: input.visibility,
    linked_member: input.linkedMember,
    person_name: input.personName,
    person_relation: input.personRelation,
    person_contact: input.personContact
  });
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

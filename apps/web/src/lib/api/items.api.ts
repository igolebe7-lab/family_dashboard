import { COLLECTIONS } from '$lib/constants/collections';
import type { ItemCategory } from '$lib/constants/categories';
import type {
  Item,
  ItemKind,
  ItemPriority,
  ItemVisibility
} from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export type CreateItemInput = {
  kind: ItemKind;
  title: string;
  description?: string;
  owner?: string;
  assignees?: string[];
  participants?: string[];
  category: ItemCategory;
  priority: ItemPriority;
  visibility: ItemVisibility;
  allDay?: boolean;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  timezone: string;
  recurrenceRule?: string;
  recurrenceUntil?: string;
  approvalRequired?: boolean;
  checklist?: unknown;
  points?: number;
  locationText?: string;
  colorOverride?: string;
};

export async function createItem(
  input: CreateItemInput,
  context?: Partial<ActiveFamilyContext>
): Promise<Item> {
  const activeContext = requireActiveContext(context);
  const items = getPocketBaseClient().collection(COLLECTIONS.items);
  const create = requireCollectionMethod(items, 'create');
  const record = await create(
    {
      family: activeContext.familyId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      created_by: activeContext.memberId,
      owner: input.owner,
      assignees: input.assignees || [],
      participants: input.participants || [],
      category: input.category,
      priority: input.priority,
      visibility: input.visibility,
      all_day: input.allDay || false,
      start_at: input.startAt,
      end_at: input.endAt,
      due_at: input.dueAt,
      timezone: input.timezone,
      recurrence_rule: input.recurrenceRule,
      recurrence_until: input.recurrenceUntil,
      approval_required: input.approvalRequired || false,
      checklist_json: input.checklist,
      points: input.points,
      location_text: input.locationText,
      color_override: input.colorOverride,
      archived: false
    },
    memberRequestOptions(activeContext)
  );

  return mapItemRecord(record);
}

export function mapItemRecord(value: unknown): Item {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    kind: asString(record.kind) as Item['kind'],
    title: asString(record.title),
    description: asString(record.description) || undefined,
    createdBy: asString(record.created_by),
    owner: asString(record.owner) || undefined,
    assignees: asStringArray(record.assignees),
    participants: asStringArray(record.participants),
    visibleTo: asStringArray(record.visible_to),
    category: asString(record.category) as Item['category'],
    priority: asString(record.priority) as Item['priority'],
    visibility: asString(record.visibility) as Item['visibility'],
    allDay: asBoolean(record.all_day),
    startAt: asString(record.start_at) || undefined,
    endAt: asString(record.end_at) || undefined,
    dueAt: asString(record.due_at) || undefined,
    timezone: asString(record.timezone),
    recurrenceRule: asString(record.recurrence_rule) || undefined,
    recurrenceUntil: asString(record.recurrence_until) || undefined,
    approvalRequired: asBoolean(record.approval_required),
    points: typeof record.points === 'number' ? record.points : undefined,
    locationText: asString(record.location_text) || undefined,
    colorOverride: asString(record.color_override) || undefined,
    archived: asBoolean(record.archived)
  };
}

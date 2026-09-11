import type { Item, ItemKind } from '$lib/types/domain';
import { COLLECTIONS } from '$lib/constants/collections';
import {
  asRecord, escapeFilterValue, getPocketBaseClient, memberRequestOptions,
  requireActiveContext, requireCollectionMethod, type ActiveFamilyContext
} from './pocketbase';
import { mapItemRecord } from './items.api';

export type SearchKind = 'all' | Extract<ItemKind, 'event' | 'task' | 'assignment'>;

export function buildItemSearchFilter(familyId: string, query: string, kind: SearchKind, archived = false): string {
  const terms = [
    `family = "${escapeFilterValue(familyId)}"`,
    `archived = ${archived}`
  ];
  const text = query.trim().slice(0, 120);
  if (text) terms.push(`(title ~ "${escapeFilterValue(text)}" || description ~ "${escapeFilterValue(text)}")`);
  if (kind !== 'all') terms.push(`kind = "${escapeFilterValue(kind)}"`);
  return terms.join(' && ');
}

export async function searchItems(
  context: ActiveFamilyContext,
  query: string,
  kind: SearchKind = 'all',
  page = 1,
  archived = false
): Promise<{ items: Item[]; totalPages: number; totalItems: number }> {
  const active = requireActiveContext(context);
  const getList = requireCollectionMethod(getPocketBaseClient().collection(COLLECTIONS.items), 'getList');
  const result = asRecord(await getList(page, 30, {
    filter: buildItemSearchFilter(active.familyId, query, kind, archived),
    sort: '-created',
    requestKey: null,
    ...memberRequestOptions(active)
  }));
  return {
    items: Array.isArray(result.items) ? result.items.map(mapItemRecord) : [],
    totalPages: typeof result.totalPages === 'number' ? result.totalPages : 1,
    totalItems: typeof result.totalItems === 'number' ? result.totalItems : 0
  };
}

import type { Item, ItemKind, ItemPriority } from '$lib/types/domain';
import { COLLECTIONS } from '$lib/constants/collections';
import {
  asRecord, escapeFilterValue, getPocketBaseClient, memberRequestOptions,
  requireActiveContext, requireCollectionMethod, type ActiveFamilyContext
} from './pocketbase';
import { mapItemRecord } from './items.api';

export type SearchKind = 'all' | Extract<ItemKind, 'event' | 'task' | 'assignment'>;

export function buildItemSearchFilter(familyId: string, query: string, kind: SearchKind, archived = false, priority: ItemPriority | 'all' = 'all'): string {
  const terms = [
    `family = "${escapeFilterValue(familyId)}"`,
    `archived = ${archived}`
  ];
  const words = [...new Set(query.trim().slice(0, 120).toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean))];
  for (const word of words) terms.push(`search_text ~ "${escapeFilterValue(word)}"`);
  if (kind !== 'all') terms.push(`kind = "${escapeFilterValue(kind)}"`);
  if (priority !== 'all') terms.push(`priority = "${escapeFilterValue(priority)}"`);
  return terms.join(' && ');
}

export async function searchItems(
  context: ActiveFamilyContext,
  query: string,
  kind: SearchKind = 'all',
  page = 1,
  archived = false,
  priority: ItemPriority | 'all' = 'all'
): Promise<{ items: Item[]; totalPages: number; totalItems: number }> {
  const active = requireActiveContext(context);
  const getList = requireCollectionMethod(getPocketBaseClient().collection(COLLECTIONS.items), 'getList');
  const result = asRecord(await getList(page, 30, {
    filter: buildItemSearchFilter(active.familyId, query, kind, archived, priority),
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

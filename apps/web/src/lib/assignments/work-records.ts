import { mapItemRecord } from '$lib/api/items.api';
import { ensureOccurrenceRange } from '$lib/api/recurrence.api';
import { buildOccurrenceRangeFilter, mapOccurrenceRecord } from '$lib/api/occurrences.api';
import { asRecord, escapeFilterValue, getPocketBaseClient, memberRequestOptions, requireActiveContext, requireCollectionMethod, type ActiveFamilyContext } from '$lib/api/pocketbase';
import { COLLECTIONS } from '$lib/constants/collections';
import type { Item, ItemOccurrence } from '$lib/types/domain';

export type WorkMode = 'assignment' | 'task' | 'child';
export type WorkRecords = { occurrences: ItemOccurrence[]; items: Item[] };

export async function loadWorkRecords(context: ActiveFamilyContext, mode: WorkMode, signal?: AbortSignal): Promise<WorkRecords> {
  const active = requireActiveContext(context);
  const from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setDate(to.getDate() + (mode === 'child' ? 7 : 90)); to.setHours(23, 59, 59, 999);
  if (signal?.aborted) throw new Error('Request cancelled');
  await ensureOccurrenceRange(active, { from: from.toISOString(), to: to.toISOString() });
  if (signal?.aborted) throw new Error('Request cancelled');
  const family = escapeFilterValue(active.familyId);
  const kinds = mode === 'child' ? '(kind = "assignment" || kind = "task" || kind = "event")' : `kind = "${mode}"`;
  const rangeFilter = buildOccurrenceRangeFilter(active.familyId, { from: from.toISOString(), to: to.toISOString() });
  // Include undated work and unresolved older work without loading completed history for all years.
  const backlog = `family = "${family}" && kind != "event" && ((start_at = "" && due_at = "") || (due_at < "${from.toISOString()}" && status != "approved" && status != "cancelled" && status != "skipped" && (status != "done" || item.approval_required = true)))`;
  const getList = requireCollectionMethod(getPocketBaseClient().collection(COLLECTIONS.itemOccurrences), 'getList');
  const occurrences = new Map<string, ItemOccurrence>();
  const items = new Map<string, Item>();
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    if (signal?.aborted) throw new Error('Request cancelled');
    const result = asRecord(await getList(page, 100, {
      filter: `item.archived = false && ${kinds} && ((${rangeFilter}) || (${backlog}))`,
      sort: 'due_at,start_at,id', expand: 'item', requestKey: null, signal,
      ...memberRequestOptions(active)
    }));
    if (signal?.aborted) throw new Error('Request cancelled');
    totalPages = typeof result.totalPages === 'number' ? Math.max(1, result.totalPages) : 1;
    if (totalPages > 20) throw new Error('Too many work records');
    for (const value of Array.isArray(result.items) ? result.items : []) {
      const record = asRecord(value);
      const occurrence = mapOccurrenceRecord(record);
      const item = mapItemRecord(asRecord(record.expand).item);
      if (occurrence.family !== active.familyId || item.family !== active.familyId || item.id !== occurrence.item) {
        throw new Error('Work item details are unavailable');
      }
      if (item.archived) continue;
      occurrences.set(occurrence.id, occurrence);
      items.set(item.id, item);
    }
  }
  return { occurrences: [...occurrences.values()], items: [...items.values()] };
}

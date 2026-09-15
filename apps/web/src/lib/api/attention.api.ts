import { COLLECTIONS } from '$lib/constants/collections';
import { mapOccurrenceRecord } from './occurrences.api';
import { ensureOccurrenceRange } from './recurrence.api';
import { asRecord, escapeFilterValue, getPocketBaseClient, memberRequestOptions, pocketBaseFilterDate, requireActiveContext, requireCollectionMethod, type ActiveFamilyContext } from './pocketbase';
import type { ItemOccurrence } from '$lib/types/domain';

export function buildAttentionFilter(familyId: string, now: Date): string {
  const end = pocketBaseFilterDate(new Date(now.getTime() + 7 * 86400000));
  const at = pocketBaseFilterDate(now);
  return `family = "${escapeFilterValue(familyId)}" && item.archived = false && status != "approved" && status != "cancelled" && status != "skipped" && (status != "done" || (kind = "assignment" && item.approval_required = true)) && ((kind = "assignment" && status = "done") || (kind != "event" && ((due_at != "" && due_at < "${at}") || (due_at = "" && start_at != "" && start_at < "${at}"))) || (start_at >= "${at}" && start_at <= "${end}") || (due_at >= "${at}" && due_at <= "${end}"))`;
}
export async function loadAttentionOccurrences(context: ActiveFamilyContext, now = new Date()): Promise<ItemOccurrence[]> {
  const active = requireActiveContext(context);
  await ensureOccurrenceRange(active, { from: now.toISOString(), to: new Date(now.getTime() + 7 * 86400000).toISOString() });
  const getList = requireCollectionMethod(getPocketBaseClient().collection(COLLECTIONS.itemOccurrences), 'getList');
  const rows: ItemOccurrence[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const result = asRecord(await getList(page, 100, { filter: buildAttentionFilter(active.familyId, now), expand: 'item', sort: 'due_at,start_at,id', requestKey: null, ...memberRequestOptions(active) }));
    totalPages = typeof result.totalPages === 'number' ? result.totalPages : 1;
    if (totalPages > 20) throw new Error('Слишком много незакрытых записей');
    for (const raw of Array.isArray(result.items) ? result.items : []) {
      const row = mapOccurrenceRecord(raw);
      if (row.family !== active.familyId || row.itemRecord?.family !== active.familyId) throw new Error('Invalid family context');
      rows.push(row);
    }
  }
  return rows;
}

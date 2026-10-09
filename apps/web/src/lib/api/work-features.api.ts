import type { Item, ItemOccurrence } from '$lib/types/domain';
import { mapOccurrenceRecord } from './occurrences.api';
import { ensureOccurrenceRange } from './recurrence.api';
import { asRecord, asString, escapeFilterValue, getPocketBaseClient, memberRequestOptions, pocketBaseFilterDate, requireActiveContext, requireCollectionMethod, type ActiveFamilyContext } from './pocketbase';

export async function toggleChecklistStep(id: string, stepId: string, done: boolean, context: ActiveFamilyContext): Promise<ItemOccurrence> {
  const active = requireActiveContext(context), client = getPocketBaseClient();
  if (!client.send) throw new Error('Чек-лист недоступен');
  const occurrence = mapOccurrenceRecord(await client.send(`/api/familytime/occurrences/${encodeURIComponent(id)}/checklist`, {
    method: 'PATCH', requestKey: null, ...memberRequestOptions(active), body: { stepId, done }
  }));
  if (occurrence.id !== id || occurrence.family !== active.familyId) throw new Error('Экземпляр недоступен');
  return occurrence;
}

export async function listWorkDates(item: Item, context: ActiveFamilyContext, occurrenceId?: string): Promise<ItemOccurrence[]> {
  const active = requireActiveContext(context), collection = getPocketBaseClient().collection('item_occurrences');
  let rows: ItemOccurrence[];
  if (occurrenceId) {
    rows = [mapOccurrenceRecord(await requireCollectionMethod(collection, 'getOne')(occurrenceId, memberRequestOptions(active)))];
  } else {
    const from = new Date(Date.now() - 30 * 86400000).toISOString(), to = new Date(Date.now() + 90 * 86400000).toISOString();
    await ensureOccurrenceRange(active, { from, to });
    const result = asRecord(await requireCollectionMethod(collection, 'getList')(1, 200, {
      filter: `family = "${escapeFilterValue(active.familyId)}" && item = "${escapeFilterValue(item.id)}" && (due_at = "" || (due_at >= "${pocketBaseFilterDate(from)}" && due_at < "${pocketBaseFilterDate(to)}") || (due_at < "${pocketBaseFilterDate(from)}" && status != "approved" && status != "done" && status != "cancelled" && status != "skipped"))`,
      sort: 'due_at,id', requestKey: null, ...memberRequestOptions(active)
    }));
    rows = (Array.isArray(result.items) ? result.items : []).map(mapOccurrenceRecord);
  }
  if (rows.some(row => row.family !== active.familyId || row.item !== item.id || !['task', 'assignment'].includes(row.kind))) throw new Error('Экземпляр недоступен');
  return rows;
}

export async function getPointsBalances(context: ActiveFamilyContext): Promise<Record<string, number>> {
  const active = requireActiveContext(context), client = getPocketBaseClient();
  if (!client.send) throw new Error('Баланс недоступен');
  const result = asRecord(await client.send('/api/familytime/points', { method: 'GET', query: { family: active.familyId }, requestKey: null, ...memberRequestOptions(active) }));
  return Object.fromEntries((Array.isArray(result.balances) ? result.balances : []).map(value => {
    const row = asRecord(value); return [asString(row.memberId), row.balance];
  }).filter((entry): entry is [string, number] => Boolean(entry[0]) && typeof entry[1] === 'number' && Number.isSafeInteger(entry[1]) && entry[1] >= 0));
}

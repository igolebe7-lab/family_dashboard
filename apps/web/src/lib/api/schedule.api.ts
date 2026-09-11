import { ensureOccurrenceRange } from './recurrence.api';
import { mapOccurrenceRecord } from './occurrences.api';
import { asRecord, escapeFilterValue, getPocketBaseClient, memberRequestOptions, requireActiveContext, requireCollectionMethod, type ActiveFamilyContext } from './pocketbase';
import type { ItemOccurrence } from '$lib/types/domain';

export async function setItemArchived(context: Partial<ActiveFamilyContext>, itemId: string, archived: boolean): Promise<void> {
  const active = requireActiveContext(context);
  const update = requireCollectionMethod(getPocketBaseClient().collection('items'), 'update');
  await update(itemId, { archived }, memberRequestOptions(active));
}

export async function listEventSchedule(context: Partial<ActiveFamilyContext>, itemId: string): Promise<ItemOccurrence[]> {
  const active = requireActiveContext(context);
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  const to = new Date(Date.now() + 90 * 86400000).toISOString();
  await ensureOccurrenceRange(active, { from, to });
  const getList = requireCollectionMethod(getPocketBaseClient().collection('item_occurrences'), 'getList');
  const result = asRecord(await getList(1, 200, {
    filter: `family = "${escapeFilterValue(active.familyId)}" && item = "${escapeFilterValue(itemId)}" && kind = "event" && start_at >= "${from}" && start_at < "${to}"`,
    sort: 'start_at,id', requestKey: null, ...memberRequestOptions(active)
  }));
  return Array.isArray(result.items) ? result.items.map(mapOccurrenceRecord) : [];
}

export async function updateScheduledOccurrence(context: Partial<ActiveFamilyContext>, id: string, input: { startAt: string; endAt: string }): Promise<ItemOccurrence> {
  const active = requireActiveContext(context);
  const client = getPocketBaseClient();
  if (!client.send) throw new Error('Сервис изменения расписания недоступен');
  return mapOccurrenceRecord(await client.send(`/api/familytime/occurrences/${encodeURIComponent(id)}/schedule`, {
    method: 'PATCH', body: input, requestKey: null, ...memberRequestOptions(active)
  }));
}

import { asRecord, asString, asStringArray, escapeFilterValue, getPocketBaseClient, memberRequestOptions, requireActiveContext, requireCollectionMethod, type ActiveFamilyContext } from './pocketbase';
import { COLLECTIONS } from '$lib/constants/collections';

export type WorkLink = { id: string; title: string; url: string };
export type WorkMedia = { id: string; family: string; item: string; occurrence: string; photos: string[]; links: WorkLink[] };
export type WorkMediaInput = { photos?: File[]; removePhotos?: string[]; links?: WorkLink[]; expectedLinks?: WorkLink[] };

function mapMedia(value: unknown, occurrence: string, context: ActiveFamilyContext): WorkMedia {
  const record = asRecord(value);
  if (record.family !== context.familyId || record.occurrence !== occurrence || !record.id || !record.item) throw new Error('Вложения недоступны');
  return { id: asString(record.id), family: asString(record.family), item: asString(record.item), occurrence, photos: asStringArray(record.photos), links: (Array.isArray(record.links_json) ? record.links_json : []).map(value => {
    const link = asRecord(value); return { id: asString(link.id), title: asString(link.title), url: asString(link.url) };
  }).filter(link => { try { const url = new URL(link.url); return Boolean(link.id) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }) };
}

export async function getWorkMedia(occurrenceId: string, context: ActiveFamilyContext): Promise<WorkMedia | null> {
  const active = requireActiveContext(context), client = getPocketBaseClient();
  if (!client.send) throw new Error('Вложения недоступны');
  const response = await client.send(`/api/familytime/work/${encodeURIComponent(occurrenceId)}/media`, {
    method: 'GET', requestKey: null, ...memberRequestOptions(active)
  });
  return response ? mapMedia(response, occurrenceId, active) : null;
}

export async function saveWorkMedia(occurrenceId: string, input: WorkMediaInput, context: ActiveFamilyContext): Promise<WorkMedia> {
  const active = requireActiveContext(context), client = getPocketBaseClient();
  if (!client.send) throw new Error('Вложения недоступны');
  const body = new FormData();
  for (const photo of input.photos ?? []) body.append('photos', photo);
  if (input.removePhotos) body.append('remove_photos_json', JSON.stringify(input.removePhotos));
  if (input.links) body.append('links_json', JSON.stringify(input.links));
  if (input.expectedLinks) body.append('expected_links_json', JSON.stringify(input.expectedLinks));
  return mapMedia(await client.send(`/api/familytime/work/${encodeURIComponent(occurrenceId)}/media`, { method: 'POST', requestKey: null, ...memberRequestOptions(active), body }), occurrenceId, active);
}

export async function subscribeWorkMedia(occurrenceId: string, context: ActiveFamilyContext, onchange: () => void): Promise<() => void> {
  const active = requireActiveContext(context);
  return await requireCollectionMethod(getPocketBaseClient().collection(COLLECTIONS.workMedia), 'subscribe')('*', event => {
    const record = asRecord(asRecord(event).record);
    if (record.family === active.familyId && record.occurrence === occurrenceId) onchange();
  }, { filter: `family = "${escapeFilterValue(active.familyId)}" && occurrence = "${escapeFilterValue(occurrenceId)}"`, ...memberRequestOptions(active) });
}

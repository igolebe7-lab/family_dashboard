import { getPocketBaseClient, memberRequestOptions, requireActiveContext, type ActiveFamilyContext } from './pocketbase';

const pending = new Map<string, Promise<void>>();

export async function ensureOccurrenceRange(context: Partial<ActiveFamilyContext>, range: { from: string; to: string }): Promise<void> {
  const active = requireActiveContext(context);
  const client = getPocketBaseClient();
  // Collection-only adapters are used by offline/unit fixtures; production SDK has send.
  if (!client.send) return;
  const key = JSON.stringify([client.authStore.token, active.familyId, active.memberId, range]);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = client.send('/api/familytime/occurrences/materialize', {
    method: 'POST', body: { family: active.familyId, ...range },
    requestKey: null, ...memberRequestOptions(active)
  }).then(() => undefined).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

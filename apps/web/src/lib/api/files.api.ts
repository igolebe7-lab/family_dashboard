import { asRecord, asString, getPocketBaseClient, type PocketBaseClientLike } from './pocketbase';

const FILE_TOKEN_CACHE_MS = 60_000;
type TokenCache = { authToken: string; token?: string; expiresAt: number; pending?: Promise<string> };
const tokens = new WeakMap<PocketBaseClientLike, TokenCache>();
const authRevisions = new WeakMap<PocketBaseClientLike, { value: number }>();

export async function protectedFileUrl(
  collection: string, id: string, filename: string, thumb?: string, refresh = false
): Promise<string> {
  const client = getPocketBaseClient();
  const authToken = client.authStore.token;
  if (!authToken || !client.authStore.isValid) throw new Error('Нужно войти в аккаунт.');
  if (!collection || !id || !filename) throw new Error('Не указан файл.');
  let authState = authRevisions.get(client);
  if (!authState) {
    authState = { value: 0 };
    authRevisions.set(client, authState);
    const observed = authState;
    client.authStore.onChange?.(() => { observed.value++; tokens.delete(client); });
  }
  const authRevision = authState.value;
  const isCurrent = () => getPocketBaseClient() === client && client.authStore.token === authToken &&
    client.authStore.isValid && authState.value === authRevision;
  let cache = tokens.get(client);
  if (!cache || cache.authToken !== authToken || refresh) {
    cache = { authToken, expiresAt: 0 };
    tokens.set(client, cache);
  }
  const entry = cache;
  if (!entry.token || entry.expiresAt <= Date.now()) {
    entry.pending ??= (async () => {
      const token = client.files
        ? await client.files.getToken({ requestKey: null })
        : asString(asRecord(await client.send?.('/api/files/token', { method: 'POST', requestKey: null })).token);
      if (!isCurrent()) {
        throw new Error('Аккаунт изменился.');
      }
      if (!token) throw new Error('Не удалось открыть защищённый файл.');
      entry.token = token;
      entry.expiresAt = Date.now() + FILE_TOKEN_CACHE_MS;
      return token;
    })();
    try { await entry.pending; }
    finally { entry.pending = undefined; }
  }
  if (!isCurrent()) {
    throw new Error('Аккаунт изменился.');
  }
  const options = { token: entry.token!, ...(thumb ? { thumb } : {}) };
  if (client.files) return client.files.getURL({ id, collectionName: collection }, filename, options);
  const base = (client.baseURL || '').replace(/\/+$/, '');
  const path = [collection, id, filename].map(encodeURIComponent).join('/');
  return `${base}/api/files/${path}?${new URLSearchParams(options)}`;
}

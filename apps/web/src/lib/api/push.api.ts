import { asRecord, asString, getPocketBaseClient } from './pocketbase';
import { getPushDevice, setPushDevice, type PushDevice, deviceStorage } from '$lib/push/device-storage';

export type PushConfig = { enabled: boolean; publicKey: string };
let operations: Promise<unknown> = Promise.resolve();
function exclusive<T>(action: () => Promise<T>): Promise<T> {
  const next = operations.then(action, action); operations = next.catch(() => {}); return next;
}
async function request(path: string, method: string, body?: unknown, authenticated = true): Promise<Record<string, unknown>> {
  const client = getPocketBaseClient();
  const root = client.baseURL || location.origin;
  const response = await fetch(new URL(`/api/familytime/push/${path}`, root), {
    method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: client.authStore.token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000), cache: 'no-store'
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'Повторите через минуту.' : 'Не удалось обновить уведомления. Проверьте подключение.');
  return response.status === 204 ? {} : asRecord(await response.json());
}
export async function getPushConfig(): Promise<PushConfig> {
  const data = await request('config', 'GET', undefined, false);
  return { enabled: data.enabled === true, publicKey: asString(data.publicKey) };
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function publicKey(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
}
function session() {
  const auth = getPocketBaseClient().authStore;
  if (!auth.isValid) throw new Error('Нужно войти в аккаунт.');
  const claims = asRecord(JSON.parse(atob(auth.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))));
  return { userId: asString(asRecord(auth.record).id), expiresAt: Number(claims.exp) * 1000 };
}
async function registration(): Promise<ServiceWorkerRegistration> {
  const current = await navigator.serviceWorker.getRegistration();
  if (!current?.active) throw new Error('Приложение ещё не готово. Обновите страницу и повторите.');
  return current;
}

export function enablePush(config: PushConfig): Promise<void> {
  return exclusive(async () => {
    const owner = session();
    const token = getPocketBaseClient().authStore.token;
    if (!config.enabled || Notification.permission !== 'granted') throw new Error('Сначала разрешите уведомления.');
    await flushRevocations();
    const worker = await registration();
    const previous = await getPushDevice();
    if (previous && previous.userId !== owner.userId) await disableCurrent();
    let subscription = await worker.pushManager.getSubscription();
    const existing = await getPushDevice();
    if (subscription && !existing) { await subscription.unsubscribe(); subscription = null; }
    const secret = existing?.secret ?? base64url(crypto.getRandomValues(new Uint8Array(32)));
    subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey(config.publicKey) });
    if (getPocketBaseClient().authStore.token !== token) { await subscription.unsubscribe(); return; }
    const data = await request('subscription', 'PUT', { ...subscription.toJSON(), secret, label: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone / iPad' : 'Браузер' });
    const device = { ...owner, id: asString(data.id), secret };
    if (!getPocketBaseClient().authStore.isValid || getPocketBaseClient().authStore.token !== token || session().userId !== owner.userId) {
      await saveRevoke(device); await setPushDevice(null); await subscription.unsubscribe(); await flushRevocations(); return;
    }
    await setPushDevice(device);
    window.dispatchEvent(new Event('familytime-push-changed'));
  });
}
async function saveRevoke(device: PushDevice) {
  const pending = await deviceStorage<PushDevice[] | undefined>('readonly', (store) => store.get('revocations'));
  const next = [...(pending ?? []).filter((entry) => entry.id !== device.id), device];
  await deviceStorage('readwrite', (store) => store.put(next, 'revocations'));
}
export async function flushRevocations(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const pending = await deviceStorage<PushDevice[] | undefined>('readonly', (store) => store.get('revocations'));
  for (const device of pending ?? []) {
    try {
      await request('revoke', 'POST', { id: device.id, secret: device.secret }, false);
      const latest = await deviceStorage<PushDevice[] | undefined>('readonly', (store) => store.get('revocations'));
      await deviceStorage('readwrite', (store) => store.put((latest ?? []).filter((entry) => entry.id !== device.id), 'revocations'));
    } catch { break; }
  }
}
async function disableCurrent(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const device = await getPushDevice();
  if (device) await saveRevoke(device);
  await setPushDevice(null);
  if ('serviceWorker' in navigator) {
    const worker = await navigator.serviceWorker.getRegistration();
    const displayed = await worker?.getNotifications(); displayed?.forEach((notice) => notice.close());
    try { await (await worker?.pushManager.getSubscription())?.unsubscribe(); } catch { /* Worker state already prevents display. */ }
  }
  window.dispatchEvent(new Event('familytime-push-changed'));
  await flushRevocations();
}
export function disablePush(): Promise<void> { return exclusive(disableCurrent); }
export async function testPush(): Promise<void> {
  const device = await getPushDevice();
  if (!device) throw new Error('Сначала включите уведомления.');
  await request('test', 'POST', { id: device.id, secret: device.secret });
}
export async function synchronizePush(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const device = await getPushDevice();
  if (!getPocketBaseClient().authStore.isValid || (device && device.userId !== session().userId)) { await disablePush(); return; }
  await flushRevocations();
  if (device) {
    if (Notification.permission !== 'granted') { await disablePush(); return; }
    await enablePush(await getPushConfig());
  }
}

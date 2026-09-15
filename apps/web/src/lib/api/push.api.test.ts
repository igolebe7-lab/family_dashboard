import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ values: new Map<string, unknown>(), unsubscribe: vi.fn(), close: vi.fn() }));
vi.mock('$lib/push/device-storage', () => ({
  getPushDevice: async () => state.values.get('device'),
  setPushDevice: async (device: unknown) => device ? state.values.set('device', device) : state.values.delete('device'),
  deviceStorage: async (_mode: string, action: (store: unknown) => unknown) => action({
    get: (key: string) => state.values.get(key), put: (value: unknown, key: string) => state.values.set(key, value), delete: (key: string) => state.values.delete(key)
  })
}));
import { disablePush, enablePush, flushRevocations, synchronizePush } from './push.api';
import { setPocketBaseClient, type PocketBaseClientLike } from './pocketbase';

const device = { id: 'subscription001', userId: 'user1', secret: 'local-secret', expiresAt: Date.now() + 3600000 };
let client: PocketBaseClientLike;
beforeEach(() => {
  state.values.clear(); state.unsubscribe.mockReset(); state.close.mockReset();
  const token = `a.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.c`;
  client = { baseURL: 'https://family.example.test', authStore: { token, isValid: true, record: { id: 'user1' }, clear: vi.fn() }, collection: vi.fn() };
  setPocketBaseClient(client);
  vi.stubGlobal('indexedDB', {});
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('navigator', { userAgent: 'Desktop', serviceWorker: { getRegistration: async () => ({
    active: {}, getNotifications: async () => [{ close: state.close }], pushManager: {
      getSubscription: async () => ({ unsubscribe: state.unsubscribe, toJSON: () => ({ endpoint: 'https://web.push.apple.com/Q/test', keys: {} }) })
    }
  }) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('device push lifecycle', () => {
  it('clears worker state and unsubscribes even when offline revoke fails, then retries', async () => {
    state.values.set('device', device);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await disablePush();
    expect(state.values.get('device')).toBeUndefined();
    expect(state.values.get('revocations')).toEqual([device]);
    expect(state.unsubscribe).toHaveBeenCalledOnce();
    expect(state.close).toHaveBeenCalledOnce();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await flushRevocations();
    expect(state.values.get('revocations')).toEqual([]);
  });
  it('does not associate the previous account device with the next account', async () => {
    state.values.set('device', device); client.authStore.record = { id: 'user2' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await synchronizePush();
    expect(state.values.get('device')).toBeUndefined();
    expect(state.unsubscribe).toHaveBeenCalledOnce();
  });
  it('does not enable a device if the account changes during registration', async () => {
    state.values.set('device', device);
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (options.method === 'PUT') { client.authStore.record = { id: 'user2' }; return Response.json({ id: 'new-device' }); }
      return new Response(null, { status: 204 });
    }));
    await enablePush({ enabled: true, publicKey: 'public' });
    expect(state.values.get('device')).not.toMatchObject({ id: 'new-device' });
    expect(state.unsubscribe).toHaveBeenCalledOnce();
  });
});

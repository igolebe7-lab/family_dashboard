import PocketBase, { BaseAuthStore } from 'pocketbase';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentSession, login, logout, observeAuthSession, refreshAuth, updateCurrentUserPassword, updateCurrentUserProfile } from './auth.api';
import { resetPocketBaseClient, resolvePocketBaseUrl, setPocketBaseClient, type PocketBaseClientLike } from './pocketbase';

const user = { id: 'user_1', collectionName: 'users', collectionId: 'users', email: 'parent@example.test', name: 'Parent' };
function token(id = 'user_1', exp = Math.floor(Date.now() / 1000) + 3600): string {
  return `header.${btoa(JSON.stringify({ id, exp }))}.signature`;
}
function setup() {
  const client = new PocketBase('http://auth.test', new BaseAuthStore());
  client.authStore.save(token(), user);
  setPocketBaseClient(client as PocketBaseClientLike);
  return client;
}
function reply(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  resetPocketBaseClient();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('auth session lifecycle with the real PocketBase SDK', () => {
  it('uses same-origin on desktop and mobile while preserving explicit URLs', () => {
    expect(resolvePocketBaseUrl('', 'https://family.example.test')).toBe('https://family.example.test');
    expect(resolvePocketBaseUrl('https://pb.example.test/', 'https://family.example.test')).toBe('https://pb.example.test');
    expect(resolvePocketBaseUrl('', 'http://192.168.1.2:5173')).toBe('http://192.168.1.2:5173');
  });

  it('observes SDK changes and expires idle sessions without polling', () => {
    vi.useFakeTimers();
    const client = setup();
    client.authStore.save(token('user_1', Math.floor(Date.now() / 1000) + 2), user);
    const observed: Array<string | null> = [];
    const stop = observeAuthSession((session) => observed.push(session?.user.id ?? null));
    expect(observed).toEqual(['user_1']);
    vi.advanceTimersByTime(2100);
    expect(observed.at(-1)).toBeNull();
    expect(client.authStore.token).toBe('');
    stop();
    client.authStore.save(token('user_2'), { ...user, id: 'user_2' });
    expect(observed.at(-1)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears expired tokens instead of leaving them in SDK storage', async () => {
    const client = setup();
    client.authStore.save(token('user_1', 1), user);
    expect(await refreshAuth()).toBeNull();
    expect(client.authStore.token).toBe('');
  });

  it('clears rejected credentials but preserves credentials after network failures', async () => {
    const client = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ message: 'Unauthorized' }, 401)));
    await expect(refreshAuth()).rejects.toMatchObject({ status: 401 });
    expect(client.authStore.token).toBe('');
    client.authStore.save(token(), user);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(refreshAuth()).rejects.toBeDefined();
    expect(client.authStore.isValid).toBe(true);
  });

  it('does not resurrect a logged-out SDK session when refresh finishes late', async () => {
    const client = setup();
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = refreshAuth();
    logout();
    finish(reply({ token: token(), record: user }));
    expect(await pending).toBeNull();
    expect(client.authStore.token).toBe('');
  });

  it('does not overwrite another tab account with a late login response', async () => {
    const client = setup();
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = login({ email: user.email, password: 'secret' });
    client.authStore.save(token('user_2'), { ...user, id: 'user_2' });
    finish(reply({ token: token(), record: user }));
    await expect(pending).rejects.toThrow();
    expect(getCurrentSession()?.user.id).toBe('user_2');
  });

  it('does not merge an old profile response into a different account', async () => {
    const client = setup();
    let finish!: (value: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = updateCurrentUserProfile({ email: user.email, name: 'Changed' });
    client.authStore.save(token('user_2'), { ...user, id: 'user_2' });
    finish(reply({ ...user, name: 'Changed' }));
    await pending;
    expect(getCurrentSession()?.user.id).toBe('user_2');
  });

  it('invalidates the old token after a successful password change', async () => {
    const client = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(user)));
    await updateCurrentUserPassword({ oldPassword: 'old', password: 'new-password', passwordConfirm: 'new-password' });
    expect(client.authStore.token).toBe('');
  });
});

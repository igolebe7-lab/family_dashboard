import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { bootstrapClientApp, clearDevelopmentShell, resolveAppRouteRedirect, watchClientSession } from './app.bootstrap';
import { type AuthSession } from '$lib/api/auth.api';
import { createFamilyStore } from './family.store';
import { createSessionStore } from './session.store';

const session = {
  token: 'token_1',
  user: { id: 'user_1', email: 'parent@example.test', name: '' }
};

const context: ActiveFamilyContext = {
  familyId: 'family_1',
  memberId: 'member_1'
};

afterEach(() => vi.unstubAllGlobals());

describe('development service worker cleanup', () => {
  it('unregisters the current worker and removes only FamilyTime shell caches', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const remove = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { serviceWorker: { controller: {}, getRegistration: async () => ({ unregister }) } });
    vi.stubGlobal('caches', { keys: async () => ['familytime-shell-old', 'other-app-cache'], delete: remove });
    expect(await clearDevelopmentShell(true)).toBe(true);
    expect(unregister).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledExactlyOnceWith('familytime-shell-old');
  });

  it('leaves production registrations and caches untouched', async () => {
    const getRegistration = vi.fn();
    const keys = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration } });
    vi.stubGlobal('caches', { keys });
    expect(await clearDevelopmentShell(false)).toBe(false);
    expect(getRegistration).not.toHaveBeenCalled();
    expect(keys).not.toHaveBeenCalled();
  });
});

describe('bootstrapClientApp', () => {
  it('clears application stores on SDK logout or account switch', () => {
    const auth = createSessionStore();
    const family = createFamilyStore();
    let change!: (value: AuthSession | null) => void;
    const stop = watchClientSession(auth, family, (callback) => {
      change = callback;
      callback(session);
      return () => {};
    });
    auth.setSession(session);
    change(null);
    expect(get(auth).isAuthenticated).toBe(false);
    expect(get(family).status).toBe('idle');
    auth.setSession(session);
    change({ ...session, user: { ...session.user, id: 'user_2' } });
    expect(get(auth).isAuthenticated).toBe(false);
    stop();
  });

  it('does not cancel bootstrap when SDK refresh updates the same account', () => {
    const auth = createSessionStore();
    const family = createFamilyStore();
    let change!: (value: AuthSession | null) => void;
    const stop = watchClientSession(auth, family, (callback) => {
      change = callback;
      callback(session);
      return () => {};
    });
    auth.setLoading();
    const revision = auth.getRevision();
    change({ ...session, token: 'refreshed' });
    expect(auth.getRevision()).toBe(revision);
    stop();
  });
  it('coalesces concurrent bootstrap calls', async () => {
    const auth = createSessionStore();
    const family = createFamilyStore();
    const refreshAuth = vi.fn().mockResolvedValue(session);
    await Promise.all([
      bootstrapClientApp(auth, family, { refreshAuth, bootstrapFamilyContext: async () => null }),
      bootstrapClientApp(auth, family, { refreshAuth, bootstrapFamilyContext: async () => null })
    ]);
    expect(refreshAuth).toHaveBeenCalledTimes(1);
  });

  it('does not restore a session after logout during refresh', async () => {
    const auth = createSessionStore();
    const family = createFamilyStore();
    let resolve!: (value: typeof session) => void;
    const pending = bootstrapClientApp(auth, family, {
      refreshAuth: () => new Promise((done) => { resolve = done; }),
      bootstrapFamilyContext: async () => context
    });
    auth.clear();
    family.clear();
    resolve(session);
    expect(await pending).toBeNull();
    expect(get(auth).isAuthenticated).toBe(false);
  });

  it('awaits family failures and clears stale context', async () => {
    const auth = createSessionStore();
    const family = createFamilyStore();
    await expect(bootstrapClientApp(auth, family, {
      refreshAuth: async () => session,
      bootstrapFamilyContext: async () => { throw new Error('family unavailable'); }
    })).rejects.toThrow('family unavailable');
    expect(get(auth).status).toBe('error');
    expect(get(family).activeMember).toBeNull();
  });
  it('refreshes auth and bootstraps active family context', async () => {
    const sessionStore = createSessionStore();
    const familyStore = createFamilyStore();
    const refreshAuth = vi.fn().mockResolvedValue(session);
    const bootstrapFamilyContext = vi.fn().mockResolvedValue(context);

    const result = await bootstrapClientApp(sessionStore, familyStore, {
      refreshAuth,
      bootstrapFamilyContext
    });

    expect(result).toEqual(context);
    expect(refreshAuth).toHaveBeenCalledOnce();
    expect(bootstrapFamilyContext).toHaveBeenCalledWith(familyStore, { preferredUserId: 'user_1' });
    expect(get(sessionStore)).toMatchObject({
      status: 'ready',
      isAuthenticated: true,
      user: session.user
    });
  });

  it('clears stores when there is no valid auth session', async () => {
    const sessionStore = createSessionStore();
    const familyStore = createFamilyStore();
    const bootstrapFamilyContext = vi.fn();

    const result = await bootstrapClientApp(sessionStore, familyStore, {
      refreshAuth: vi.fn().mockResolvedValue(null),
      bootstrapFamilyContext
    });

    expect(result).toBeNull();
    expect(bootstrapFamilyContext).not.toHaveBeenCalled();
    expect(get(sessionStore).isAuthenticated).toBe(false);
    expect(get(familyStore).activeFamily).toBeNull();
  });

  it('stores a user-facing auth error when refresh fails', async () => {
    const sessionStore = createSessionStore();
    const familyStore = createFamilyStore();

    await expect(
      bootstrapClientApp(sessionStore, familyStore, {
        refreshAuth: vi.fn().mockRejectedValue(new Error('expired token')),
        bootstrapFamilyContext: vi.fn()
      })
    ).rejects.toThrow('expired token');

    expect(get(sessionStore)).toMatchObject({
      status: 'error',
      error: 'Не удалось восстановить сессию'
    });
    expect(get(familyStore).status).toBe('idle');
  });
});

describe('resolveAppRouteRedirect', () => {
  it('protects direct child entry and nested child routes', () => {
    for (const pathname of ['/child', '/child/settings']) {
      expect(resolveAppRouteRedirect({ pathname, isAuthenticated: false, hasFamilyContext: false })).toBe('/login');
    }
    expect(resolveAppRouteRedirect({ pathname: '/child', isAuthenticated: true, hasFamilyContext: false })).toBe('/app/onboarding');
  });

  it('does not match unrelated route prefixes', () => {
    expect(resolveAppRouteRedirect({ pathname: '/application', isAuthenticated: false, hasFamilyContext: false })).toBeNull();
  });
  it('redirects unauthenticated app routes to login', () => {
    expect(
      resolveAppRouteRedirect({
        pathname: '/app/today',
        isAuthenticated: false,
        hasFamilyContext: false
      })
    ).toBe('/login');
  });

  it('redirects authenticated app routes without family to onboarding', () => {
    expect(
      resolveAppRouteRedirect({
        pathname: '/app/today',
        isAuthenticated: true,
        hasFamilyContext: false
      })
    ).toBe('/app/onboarding');
  });

  it('keeps onboarding available until the first family exists', () => {
    expect(
      resolveAppRouteRedirect({
        pathname: '/app/onboarding',
        isAuthenticated: true,
        hasFamilyContext: false
      })
    ).toBeNull();
  });

  it('returns family owners from onboarding to today', () => {
    expect(
      resolveAppRouteRedirect({
        pathname: '/app/onboarding',
        isAuthenticated: true,
        hasFamilyContext: true
      })
    ).toBe('/app/today');
  });

  it('does not guard auth and invite routes', () => {
    expect(
      resolveAppRouteRedirect({
        pathname: '/login',
        isAuthenticated: false,
        hasFamilyContext: false
      })
    ).toBeNull();
  });
});

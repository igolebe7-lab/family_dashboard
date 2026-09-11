import { get } from 'svelte/store';
import { observeAuthSession, refreshAuth } from '$lib/api/auth.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { BootstrapFamilyDependencies } from './family.bootstrap';
import { familyStore, type createFamilyStore } from './family.store';
import { bootstrapFamilyContext } from './family.bootstrap';
import { sessionStore, type createSessionStore } from './session.store';

type FamilyStoreApi = ReturnType<typeof createFamilyStore>;
type SessionStoreApi = ReturnType<typeof createSessionStore>;

export type AppRouteGuardState = {
  pathname: string;
  isAuthenticated: boolean;
  hasFamilyContext: boolean;
};

export type BootstrapClientAppDependencies = {
  refreshAuth?: typeof refreshAuth;
  bootstrapFamilyContext?: (
    store: FamilyStoreApi,
    dependencies?: BootstrapFamilyDependencies
  ) => Promise<ActiveFamilyContext | null>;
};

const pendingBootstraps = new WeakMap<SessionStoreApi, {
  revision: number;
  promise: Promise<ActiveFamilyContext | null>;
}>();

export function bootstrapClientApp(
  session: SessionStoreApi = sessionStore,
  family: FamilyStoreApi = familyStore,
  dependencies: BootstrapClientAppDependencies = {}
): Promise<ActiveFamilyContext | null> {
  const pending = pendingBootstraps.get(session);
  if (pending?.revision === session.getRevision()) return pending.promise;
  const entry = { revision: 0, promise: Promise.resolve<ActiveFamilyContext | null>(null) };
  entry.promise = runBootstrap(session, family, dependencies, entry).finally(() => {
    if (pendingBootstraps.get(session) === entry) pendingBootstraps.delete(session);
  });
  entry.revision = session.getRevision();
  pendingBootstraps.set(session, entry);
  return entry.promise;
}

async function runBootstrap(
  session: SessionStoreApi,
  family: FamilyStoreApi,
  dependencies: BootstrapClientAppDependencies,
  entry: { revision: number }
): Promise<ActiveFamilyContext | null> {
  const refresh = dependencies.refreshAuth ?? refreshAuth;
  const bootstrapFamily = dependencies.bootstrapFamilyContext ?? bootstrapFamilyContext;

  session.setLoading();
  family.clear();
  entry.revision = session.getRevision();
  const isCurrent = () => entry.revision === session.getRevision();

  try {
    const authSession = await refresh();
    if (!isCurrent()) return null;

    if (!authSession) {
      session.clear();
      family.clear();
      return null;
    }

    session.setSession(authSession);
    entry.revision = session.getRevision();
    const context = await bootstrapFamily(family, { preferredUserId: authSession.user.id });
    return isCurrent() ? context : null;
  } catch (error) {
    if (!isCurrent()) return null;
    family.clear();
    session.setError('Не удалось восстановить сессию');
    throw error;
  }
}

export function resolveAppRouteRedirect(state: AppRouteGuardState): string | null {
  if (!isProtectedAppRoute(state.pathname)) return null;

  if (!state.isAuthenticated) {
    return '/login';
  }

  if (state.pathname === '/app/onboarding') {
    return state.hasFamilyContext ? '/app/today' : null;
  }

  return state.hasFamilyContext ? null : '/app/onboarding';
}

export function isProtectedAppRoute(pathname: string): boolean {
  return ['/app', '/child'].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function watchClientSession(
  session: SessionStoreApi = sessionStore,
  family: FamilyStoreApi = familyStore,
  observe = observeAuthSession,
  onInvalidated: () => void = () => {}
): () => void {
  let initialized = false;
  let userId: string | undefined;
  return observe((auth) => {
    const changedAccount = initialized && userId !== auth?.user.id;
    initialized = true;
    userId = auth?.user.id;
    const state = get(session);
    if (!auth || changedAccount) {
      session.clear();
      family.clear();
      onInvalidated();
    } else if (state.status === 'ready' && state.user?.id === auth.user.id && get(family).status !== 'loading') {
      session.setSession(auth);
    }
  });
}

export async function clearDevelopmentShell(development = import.meta.env.DEV): Promise<boolean> {
  if (!development) return false;
  let controlled = false;
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    controlled = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.unregister();
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('familytime-shell-')).map((key) => caches.delete(key)));
  }
  return controlled;
}

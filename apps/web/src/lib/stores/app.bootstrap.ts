import { refreshAuth } from '$lib/api/auth.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { BootstrapFamilyDependencies } from './family.bootstrap';
import { familyStore, type createFamilyStore } from './family.store';
import { bootstrapFamilyContext } from './family.bootstrap';
import { sessionStore, type createSessionStore } from './session.store';

type FamilyStoreApi = ReturnType<typeof createFamilyStore>;
type SessionStoreApi = ReturnType<typeof createSessionStore>;

export type BootstrapClientAppDependencies = {
  refreshAuth?: typeof refreshAuth;
  bootstrapFamilyContext?: (
    store: FamilyStoreApi,
    dependencies?: BootstrapFamilyDependencies
  ) => Promise<ActiveFamilyContext | null>;
};

export async function bootstrapClientApp(
  session: SessionStoreApi = sessionStore,
  family: FamilyStoreApi = familyStore,
  dependencies: BootstrapClientAppDependencies = {}
): Promise<ActiveFamilyContext | null> {
  const refresh = dependencies.refreshAuth ?? refreshAuth;
  const bootstrapFamily = dependencies.bootstrapFamilyContext ?? bootstrapFamilyContext;

  session.setLoading();

  try {
    const authSession = await refresh();

    if (!authSession) {
      session.clear();
      family.clear();
      return null;
    }

    session.setSession(authSession);
    return bootstrapFamily(family, { preferredUserId: authSession.user.id });
  } catch (error) {
    session.setError('Не удалось восстановить сессию');
    throw error;
  }
}

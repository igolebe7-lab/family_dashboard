import { writable } from 'svelte/store';

import type { AuthSession, AuthUser } from '$lib/api/auth.api';

export type SessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SessionState = {
  status: SessionStatus;
  token: string | null;
  user: AuthUser | null;
  error: string | null;
  isAuthenticated: boolean;
};

const initialSessionState: SessionState = {
  status: 'idle',
  token: null,
  user: null,
  error: null,
  isAuthenticated: false
};

export function createSessionStore() {
  const store = writable<SessionState>(initialSessionState);
  let revision = 0;
  function set(state: SessionState): void {
    revision += 1;
    store.set(state);
  }

  return {
    subscribe: store.subscribe,
    getRevision: () => revision,
    setLoading: () =>
      set({
        ...initialSessionState,
        status: 'loading'
      }),
    setSession: (session: AuthSession) =>
      set({
        status: 'ready',
        token: session.token,
        user: session.user,
        error: null,
        isAuthenticated: true
      }),
    setError: (error: string) =>
      set({
        ...initialSessionState,
        status: 'error',
        error
      }),
    clear: () => set(initialSessionState)
  };
}

export const sessionStore = createSessionStore();

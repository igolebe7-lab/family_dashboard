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

  return {
    subscribe: store.subscribe,
    setLoading: () =>
      store.set({
        ...initialSessionState,
        status: 'loading'
      }),
    setSession: (session: AuthSession) =>
      store.set({
        status: 'ready',
        token: session.token,
        user: session.user,
        error: null,
        isAuthenticated: true
      }),
    setError: (error: string) =>
      store.set({
        ...initialSessionState,
        status: 'error',
        error
      }),
    clear: () => store.set(initialSessionState)
  };
}

export const sessionStore = createSessionStore();

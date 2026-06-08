import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import { createSessionStore } from './session.store';

describe('createSessionStore', () => {
  it('tracks loading, authenticated session, error and clear states', () => {
    const session = createSessionStore();

    expect(get(session).status).toBe('idle');
    expect(get(session).isAuthenticated).toBe(false);

    session.setLoading();
    expect(get(session)).toMatchObject({
      status: 'loading',
      error: null,
      isAuthenticated: false
    });

    session.setSession({
      token: 'token_1',
      user: { id: 'user_1', email: 'parent@example.test' }
    });
    expect(get(session)).toMatchObject({
      status: 'ready',
      error: null,
      isAuthenticated: true,
      token: 'token_1',
      user: { id: 'user_1', email: 'parent@example.test' }
    });

    session.setError('Не удалось войти');
    expect(get(session)).toMatchObject({
      status: 'error',
      error: 'Не удалось войти',
      isAuthenticated: false
    });

    session.clear();
    expect(get(session)).toMatchObject({
      status: 'idle',
      error: null,
      isAuthenticated: false,
      token: null,
      user: null
    });
  });
});

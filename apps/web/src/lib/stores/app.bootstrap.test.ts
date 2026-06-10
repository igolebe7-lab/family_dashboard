import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { bootstrapClientApp } from './app.bootstrap';
import { createFamilyStore } from './family.store';
import { createSessionStore } from './session.store';

const session = {
  token: 'token_1',
  user: { id: 'user_1', email: 'parent@example.test' }
};

const context: ActiveFamilyContext = {
  familyId: 'family_1',
  memberId: 'member_1'
};

describe('bootstrapClientApp', () => {
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
    expect(bootstrapFamilyContext).toHaveBeenCalledWith(familyStore);
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

import { describe, expect, it, vi } from 'vitest';

import { COLLECTIONS } from '$lib/constants/collections';
import type { ItemCategory } from '$lib/constants/categories';
import type { ItemKind, ItemPriority, ItemVisibility } from '$lib/types/domain';
import {
  resetPocketBaseClient,
  resolvePocketBaseUrl,
  setPocketBaseClient
} from './pocketbase';
import { login, logout } from './auth.api';
import { createFamily } from './families.api';
import { createItem } from './items.api';
import { listOccurrencesInRange } from './occurrences.api';

type FakeCollectionService = {
  authWithPassword?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  getList?: ReturnType<typeof vi.fn>;
};

type FakeClient = {
  authStore: {
    clear: ReturnType<typeof vi.fn>;
    isValid: boolean;
    token: string;
    record: unknown;
  };
  collection: ReturnType<typeof vi.fn>;
};

function createFakeClient(services: Record<string, FakeCollectionService>): FakeClient {
  return {
    authStore: {
      clear: vi.fn(),
      isValid: false,
      token: '',
      record: null
    },
    collection: vi.fn((name: string) => services[name])
  };
}

describe('PocketBase API layer', () => {
  it('normalizes configured PocketBase base URLs', () => {
    expect(resolvePocketBaseUrl('https://family.example.com/pb/')).toBe(
      'https://family.example.com/pb'
    );
    expect(resolvePocketBaseUrl('')).toBe('http://127.0.0.1:8090');
  });

  it('authenticates and clears auth state through the users collection', async () => {
    const users = {
      authWithPassword: vi.fn().mockResolvedValue({
        token: 'token_1',
        record: { id: 'user_1', email: 'parent@example.test' }
      })
    };
    const client = createFakeClient({ [COLLECTIONS.users]: users });
    setPocketBaseClient(client);

    const session = await login({
      email: 'parent@example.test',
      password: 'secret'
    });
    logout();

    expect(client.collection).toHaveBeenCalledWith(COLLECTIONS.users);
    expect(users.authWithPassword).toHaveBeenCalledWith('parent@example.test', 'secret');
    expect(session).toEqual({
      token: 'token_1',
      user: { id: 'user_1', email: 'parent@example.test' }
    });
    expect(client.authStore.clear).toHaveBeenCalledOnce();

    resetPocketBaseClient();
  });

  it('creates a family with the authenticated owner user', async () => {
    const families = {
      create: vi.fn().mockResolvedValue({
        id: 'family_1',
        name: 'Дом',
        slug: 'dom',
        timezone: 'Europe/Amsterdam',
        owner_user: 'user_1'
      })
    };
    const client = createFakeClient({ [COLLECTIONS.families]: families });
    setPocketBaseClient(client);

    const family = await createFamily(
      { name: 'Дом', slug: 'dom', timezone: 'Europe/Amsterdam' },
      { userId: 'user_1' }
    );

    expect(families.create).toHaveBeenCalledWith({
      name: 'Дом',
      slug: 'dom',
      timezone: 'Europe/Amsterdam',
      owner_user: 'user_1'
    });
    expect(family).toEqual({
      id: 'family_1',
      name: 'Дом',
      slug: 'dom',
      timezone: 'Europe/Amsterdam',
      ownerUser: 'user_1'
    });

    resetPocketBaseClient();
  });

  it('requires active family/member context before creating items', async () => {
    const items = {
      create: vi.fn().mockResolvedValue({
        id: 'item_1',
        family: 'family_1',
        kind: 'task' satisfies ItemKind,
        title: 'Купить хлеб',
        created_by: 'member_1',
        assignees: [],
        participants: [],
        visible_to: ['member_1'],
        category: 'shopping' satisfies ItemCategory,
        priority: 'normal' satisfies ItemPriority,
        visibility: 'private' satisfies ItemVisibility,
        all_day: false,
        timezone: 'Europe/Amsterdam',
        approval_required: false,
        archived: false,
        collectionId: 'items',
        collectionName: COLLECTIONS.items,
        created: '2026-06-08 10:00:00.000Z',
        updated: '2026-06-08 10:00:00.000Z'
      })
    };
    const client = createFakeClient({ [COLLECTIONS.items]: items });
    setPocketBaseClient(client);

    await expect(
      createItem({
        kind: 'task',
        title: 'Купить хлеб',
        category: 'shopping',
        priority: 'normal',
        visibility: 'private',
        timezone: 'Europe/Amsterdam'
      })
    ).rejects.toThrow('active family and member');

    const item = await createItem(
      {
        kind: 'task',
        title: 'Купить хлеб',
        category: 'shopping',
        priority: 'normal',
        visibility: 'private',
        timezone: 'Europe/Amsterdam'
      },
      { familyId: 'family_1', memberId: 'member_1' }
    );

    expect(items.create).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'family_1',
        created_by: 'member_1',
        title: 'Купить хлеб'
      }),
      { headers: { 'X-Family-Member-Id': 'member_1' } }
    );
    expect(item.visibleTo).toEqual(['member_1']);

    resetPocketBaseClient();
  });

  it('loads occurrences only inside the requested visible range', async () => {
    const occurrences = {
      getList: vi.fn().mockResolvedValue({
        page: 1,
        perPage: 200,
        totalItems: 0,
        totalPages: 0,
        items: []
      })
    };
    const client = createFakeClient({ [COLLECTIONS.itemOccurrences]: occurrences });
    setPocketBaseClient(client);

    const result = await listOccurrencesInRange(
      {
        familyId: 'family_1',
        memberId: 'member_1'
      },
      {
        from: '2026-06-08T00:00:00.000Z',
        to: '2026-06-15T00:00:00.000Z'
      }
    );

    expect(occurrences.getList).toHaveBeenCalledWith(
      1,
      200,
      expect.objectContaining({
        filter: expect.stringContaining('family = "family_1"'),
        sort: 'start_at,due_at'
      })
    );
    expect(occurrences.getList.mock.calls[0][2].filter).toContain(
      'start_at < "2026-06-15T00:00:00.000Z"'
    );
    expect(result.items).toEqual([]);

    resetPocketBaseClient();
  });
});

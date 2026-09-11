import { describe, expect, it, vi } from 'vitest';

import { COLLECTIONS } from '$lib/constants/collections';
import type { ItemCategory } from '$lib/constants/categories';
import type { DayAnnotationKind, ItemKind, ItemPriority, ItemVisibility } from '$lib/types/domain';
import {
  resetPocketBaseClient,
  resolvePocketBaseUrl,
  setPocketBaseClient
} from './pocketbase';
import {
  login,
  logout,
  registerAdult,
  requestPasswordReset,
  confirmPasswordReset,
  getAuthErrorMessage,
  updateCurrentUserPassword,
  updateCurrentUserProfile
} from './auth.api';
import { createFamily, createFamilyWithOwner } from './families.api';
import { createItem } from './items.api';
import {
  approveOccurrence,
  listOccurrenceMarkersInRange,
  listOccurrencesInRange,
  markOccurrenceDone,
  rejectOccurrence,
  subscribeOccurrencesInRange
} from './occurrences.api';
import {
  createDayAnnotation,
  deleteDayAnnotation,
  listDayAnnotationsForYear,
  updateDayAnnotation
} from './day-annotations.api';
import { createMember, updateMember } from './members.api';
import {
  acceptInvitation,
  createInvitation,
  getInvitationPreview
} from './invitations.api';
import { listActivity, subscribeActivity } from './activity.api';
import {
  listNotifications,
  listUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from './notifications.api';

type FakeCollectionService = {
  authWithPassword?: ReturnType<typeof vi.fn>;
  requestPasswordReset?: ReturnType<typeof vi.fn>;
  confirmPasswordReset?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  getFirstListItem?: ReturnType<typeof vi.fn>;
  getList?: ReturnType<typeof vi.fn>;
  subscribe?: ReturnType<typeof vi.fn>;
};

type FakeClient = {
  authStore: {
    clear: ReturnType<typeof vi.fn>;
    isValid: boolean;
    token: string;
    record: unknown;
  };
  collection: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

function createFakeClient(
  services: Record<string, FakeCollectionService>,
  send: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined)
): FakeClient {
  return {
    authStore: {
      clear: vi.fn(),
      isValid: false,
      token: '',
      record: null
    },
    collection: vi.fn((name: string) => services[name]),
    send
  };
}

describe('PocketBase API layer', () => {
  it('normalizes configured PocketBase base URLs', () => {
    expect(resolvePocketBaseUrl('https://family.example.com/pb/')).toBe(
      'https://family.example.com/pb'
    );
    expect(resolvePocketBaseUrl('')).toBe('/');
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
      user: { id: 'user_1', email: 'parent@example.test', name: '' }
    });
    expect(client.authStore.clear).toHaveBeenCalledOnce();

    resetPocketBaseClient();
  });

  it('registers an adult auth user through the users collection', async () => {
    const users = {
      create: vi.fn().mockResolvedValue({
        id: 'user_1',
        email: 'parent@example.test',
        name: 'Мама'
      })
    };
    const client = createFakeClient({ [COLLECTIONS.users]: users });
    setPocketBaseClient(client);

    const user = await registerAdult({
      email: 'parent@example.test',
      password: 'secret123',
      passwordConfirm: 'secret123',
      name: 'Мама'
    });

    expect(users.create).toHaveBeenCalledWith({
      email: 'parent@example.test',
      password: 'secret123',
      passwordConfirm: 'secret123',
      name: 'Мама',
      verified: false
    });
    expect(user).toEqual({ id: 'user_1', email: 'parent@example.test', name: 'Мама' });

    resetPocketBaseClient();
  });

  it('updates current auth profile and password through the users collection', async () => {
    const users = {
      update: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'user_1',
          email: 'new-parent@example.test',
          name: 'Мама'
        })
        .mockResolvedValueOnce({
          id: 'user_1',
          email: 'new-parent@example.test',
          name: 'Мама'
        })
    };
    const client = createFakeClient({ [COLLECTIONS.users]: users });
    client.authStore.isValid = true;
    client.authStore.token = 'token_1';
    client.authStore.record = {
      id: 'user_1',
      email: 'parent@example.test',
      name: 'Старое имя'
    };
    setPocketBaseClient(client);

    const profile = await updateCurrentUserProfile({
      email: 'new-parent@example.test',
      name: 'Мама'
    });
    const passwordProfile = await updateCurrentUserPassword({
      oldPassword: 'old-secret',
      password: 'new-secret-123',
      passwordConfirm: 'new-secret-123'
    });

    expect(users.update).toHaveBeenNthCalledWith(1, 'user_1', {
      email: 'new-parent@example.test',
      name: 'Мама'
    });
    expect(users.update).toHaveBeenNthCalledWith(2, 'user_1', {
      oldPassword: 'old-secret',
      password: 'new-secret-123',
      passwordConfirm: 'new-secret-123'
    });
    expect(profile).toEqual({
      id: 'user_1',
      email: 'new-parent@example.test',
      name: 'Мама'
    });
    expect(passwordProfile).toEqual({
      id: 'user_1',
      email: 'new-parent@example.test',
      name: 'Мама'
    });

    resetPocketBaseClient();
  });

  it('requests and confirms password resets through auth collection helpers', async () => {
    const users = {
      requestPasswordReset: vi.fn().mockResolvedValue(undefined),
      confirmPasswordReset: vi.fn().mockResolvedValue(undefined)
    };
    const client = createFakeClient({ [COLLECTIONS.users]: users });
    setPocketBaseClient(client);

    await requestPasswordReset(' parent@example.test ');
    await confirmPasswordReset({
      token: 'reset_token',
      password: 'new-secret-123',
      passwordConfirm: 'new-secret-123'
    });

    expect(users.requestPasswordReset).toHaveBeenCalledWith('parent@example.test');
    expect(users.confirmPasswordReset).toHaveBeenCalledWith(
      'reset_token',
      'new-secret-123',
      'new-secret-123'
    );
    expect(
      getAuthErrorMessage(
        {
          data: {
            data: {
              password: { message: 'Password is too short.' }
            }
          }
        },
        'Не удалось обновить пароль.'
      )
    ).toBe('Password is too short.');

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

  it('creates the first family and owner member during onboarding', async () => {
    const families = {
      create: vi.fn().mockResolvedValue({
        id: 'family_1',
        name: 'Дом',
        slug: 'dom',
        timezone: 'Europe/Amsterdam',
        owner_user: 'user_1'
      })
    };
    const members = {
      create: vi.fn().mockResolvedValue({
        id: 'member_owner',
        family: 'family_1',
        user: 'user_1',
        display_name: 'Мама',
        role: 'owner',
        color_key: 'peach',
        managed_by: [],
        active: true
      })
    };
    const client = createFakeClient({
      [COLLECTIONS.families]: families,
      [COLLECTIONS.familyMembers]: members
    });
    setPocketBaseClient(client);

    const result = await createFamilyWithOwner({
      familyName: 'Дом',
      ownerName: 'Мама',
      ownerUserId: 'user_1',
      timezone: 'Europe/Amsterdam'
    });

    expect(families.create).toHaveBeenCalledWith({
      name: 'Дом',
      slug: expect.stringMatching(/^dom/),
      timezone: 'Europe/Amsterdam',
      owner_user: 'user_1'
    });
    expect(members.create).toHaveBeenCalledWith({
      family: 'family_1',
      user: 'user_1',
      display_name: 'Мама',
      role: 'owner',
      color_key: 'peach',
      active: true
    });
    expect(result.member.role).toBe('owner');

    resetPocketBaseClient();
  });

  it('creates and links family members through member context', async () => {
    const createdRecord = {
      id: 'member_dad',
      family: 'family_1',
      display_name: 'Папа',
      role: 'parent',
      color_key: 'blue',
      managed_by: [],
      active: true
    };
    const members = {
      create: vi.fn().mockResolvedValue(createdRecord),
      update: vi.fn().mockResolvedValue({
        ...createdRecord,
        user: 'user_1'
      })
    };
    const client = createFakeClient({ [COLLECTIONS.familyMembers]: members });
    setPocketBaseClient(client);

    const context = { familyId: 'family_1', memberId: 'member_mom' };
    await createMember(
      {
        displayName: 'Папа',
        role: 'parent',
        colorKey: 'blue'
      },
      context
    );
    const linked = await updateMember('member_dad', { user: 'user_1' }, context);

    expect(members.create).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'family_1',
        display_name: 'Папа',
        role: 'parent',
        color_key: 'blue',
        created_by: 'member_mom'
      }),
      { headers: { 'X-Family-Member-Id': 'member_mom' } }
    );
    expect(members.update).toHaveBeenCalledWith(
      'member_dad',
      { user: 'user_1' },
      { headers: { 'X-Family-Member-Id': 'member_mom' } }
    );
    expect(linked.user).toBe('user_1');

    resetPocketBaseClient();
  });

  it('creates child profiles with managed parent links', async () => {
    const members = {
      create: vi.fn().mockResolvedValue({
        id: 'member_child',
        family: 'family_1',
        display_name: 'Миша',
        role: 'child',
        color_key: 'green',
        managed_by: ['member_parent'],
        active: true
      })
    };
    const client = createFakeClient({ [COLLECTIONS.familyMembers]: members });
    setPocketBaseClient(client);

    await createMember(
      {
        displayName: 'Миша',
        role: 'child',
        colorKey: 'green',
        managedBy: ['member_parent']
      },
      { familyId: 'family_1', memberId: 'member_parent' }
    );

    expect(members.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'child',
        managed_by: ['member_parent']
      }),
      { headers: { 'X-Family-Member-Id': 'member_parent' } }
    );

    resetPocketBaseClient();
  });

  it('creates and accepts adult family invitations by code', async () => {
    const invitations = {
      create: vi.fn().mockResolvedValue({
        id: 'invite_1',
        family: 'family_1',
        member: 'member_dad',
        code: 'ABC123',
        role: 'parent',
        email: 'dad@example.test',
        created_by: 'member_mom',
        expires_at: '2026-06-22T10:00:00.000Z'
      }),
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 'invite_1',
        family: 'family_1',
        member: 'member_dad',
        code: 'ABC123',
        role: 'parent',
        email: 'dad@example.test',
        created_by: 'member_mom',
        expires_at: '2026-06-22T10:00:00.000Z'
      })
    };
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'invite_1',
        family: 'family_1',
        member: 'member_dad',
        code: 'ABC123',
        role: 'parent',
        email: 'dad@example.test',
        created_by: 'member_mom',
        expires_at: '2026-06-22T10:00:00.000Z'
      })
      .mockResolvedValueOnce({
        family: {
          id: 'family_1',
          name: 'Дом',
          slug: 'dom',
          timezone: 'Europe/Amsterdam',
          owner_user: 'user_mom'
        },
        member: {
          id: 'member_dad',
          family: 'family_1',
          user: 'user_dad',
          display_name: 'Папа',
          role: 'parent',
          color_key: 'blue',
          managed_by: [],
          active: true
        },
        invitation: {
          id: 'invite_1',
          family: 'family_1',
          member: 'member_dad',
          code: 'ABC123',
          role: 'parent',
          email: 'dad@example.test',
          created_by: 'member_mom',
          expires_at: '2026-06-22T10:00:00.000Z',
          used_by_user: 'user_dad',
          used_at: '2026-06-15T10:00:00.000Z'
        }
      });
    const client = createFakeClient({ [COLLECTIONS.invitations]: invitations }, send);
    setPocketBaseClient(client);

    const invite = await createInvitation(
      {
        memberId: 'member_dad',
        role: 'parent',
        email: 'dad@example.test'
      },
      { familyId: 'family_1', memberId: 'member_mom' }
    );
    const preview = await getInvitationPreview('ABC123');
    const accepted = await acceptInvitation('ABC123');

    expect(invitations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'family_1',
        member: 'member_dad',
        role: 'parent',
        email: 'dad@example.test',
        created_by: 'member_mom'
      }),
      { headers: { 'X-Family-Member-Id': 'member_mom' } }
    );
    expect(send).toHaveBeenCalledWith('/familytime/invitations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'ABC123' }
    });
    expect(send).toHaveBeenCalledWith('/familytime/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'ABC123' }
    });
    expect(invite.code).toBe('ABC123');
    expect(preview.code).toBe('ABC123');
    expect(accepted.invitation.code).toBe('ABC123');
    expect(accepted.member.user).toBe('user_dad');

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
        sort: 'start_at,due_at,id'
      })
    );
    expect(occurrences.getList.mock.calls[0][2].filter).toContain(
      'start_at < "2026-06-15T00:00:00.000Z"'
    );
    expect(result.items).toEqual([]);

    resetPocketBaseClient();
  });

  it('updates assignment occurrence status through explicit approval helpers', async () => {
    const updatedRecord = {
      id: 'occ_trash',
      family: 'family_1',
      item: 'item_trash',
      visible_to: ['member_parent', 'member_child'],
      kind: 'assignment' satisfies ItemKind,
      title_snapshot: 'Вынести мусор',
      category_snapshot: 'home' satisfies ItemCategory,
      due_at: '2026-06-10T09:00:00.000Z',
      all_day: false,
      status: 'done',
      completed_by: 'member_child',
      completed_at: '2026-06-10T08:30:00.000Z'
    };
    const occurrences = {
      update: vi.fn().mockResolvedValue(updatedRecord)
    };
    const client = createFakeClient({ [COLLECTIONS.itemOccurrences]: occurrences });
    setPocketBaseClient(client);

    const context = { familyId: 'family_1', memberId: 'member_parent' };
    const done = await markOccurrenceDone('occ_trash', context);
    await approveOccurrence('occ_trash', context);
    await rejectOccurrence('occ_trash', context, 'Нужно чуть поправить');

    expect(occurrences.update).toHaveBeenNthCalledWith(
      1,
      'occ_trash',
      { status: 'done' },
      { headers: { 'X-Family-Member-Id': 'member_parent' } }
    );
    expect(occurrences.update).toHaveBeenNthCalledWith(
      2,
      'occ_trash',
      { status: 'approved' },
      { headers: { 'X-Family-Member-Id': 'member_parent' } }
    );
    expect(occurrences.update).toHaveBeenNthCalledWith(
      3,
      'occ_trash',
      { status: 'rejected', rejection_reason: 'Нужно чуть поправить' },
      { headers: { 'X-Family-Member-Id': 'member_parent' } }
    );
    expect(done.status).toBe('done');
    expect(done.completedBy).toBe('member_child');

    resetPocketBaseClient();
  });

  it('loads lightweight occurrence markers page by page for calendar overview', async () => {
    const occurrences = {
      getList: vi
        .fn()
        .mockResolvedValueOnce({
          page: 1,
          perPage: 2,
          totalItems: 3,
          totalPages: 2,
          items: [
            {
              id: 'occ_event',
              kind: 'event',
              start_at: '2026-06-10T08:00:00.000Z',
              due_at: ''
            },
            {
              id: 'occ_assignment',
              kind: 'assignment',
              start_at: '',
              due_at: '2026-06-11T18:00:00.000Z'
            }
          ]
        })
        .mockResolvedValueOnce({
          page: 2,
          perPage: 2,
          totalItems: 3,
          totalPages: 2,
          items: [
            {
              id: 'occ_task',
              kind: 'task',
              start_at: '',
              due_at: '2026-06-12T12:00:00.000Z'
            }
          ]
        })
    };
    const client = createFakeClient({ [COLLECTIONS.itemOccurrences]: occurrences });
    setPocketBaseClient(client);

    const result = await listOccurrenceMarkersInRange(
      {
        familyId: 'family_1',
        memberId: 'member_1'
      },
      {
        from: '2026-01-01T00:00:00.000Z',
        to: '2027-01-01T00:00:00.000Z'
      },
      { perPage: 2 }
    );

    expect(occurrences.getList).toHaveBeenCalledTimes(2);
    expect(occurrences.getList).toHaveBeenNthCalledWith(
      1,
      1,
      2,
      expect.objectContaining({
        fields: 'id,kind,start_at,due_at',
        filter: expect.stringContaining(
          '(kind = "event" || kind = "task" || kind = "assignment")'
        ),
        sort: 'start_at,due_at'
      })
    );
    expect(occurrences.getList.mock.calls[0][2].filter).toContain(
      '&& ( ( start_at != ""'
    );
    expect(result.items).toEqual([
      {
        id: 'occ_event',
        kind: 'event',
        startAt: '2026-06-10T08:00:00.000Z'
      },
      {
        id: 'occ_assignment',
        kind: 'assignment',
        dueAt: '2026-06-11T18:00:00.000Z'
      },
      {
        id: 'occ_task',
        kind: 'task',
        dueAt: '2026-06-12T12:00:00.000Z'
      }
    ]);

    resetPocketBaseClient();
  });

  it('loads yearly and one-time day annotations for the selected year', async () => {
    const dayAnnotations = {
      getList: vi.fn().mockResolvedValue({
        page: 1,
        perPage: 200,
        totalItems: 2,
        totalPages: 1,
        items: [
          {
            id: 'birthday_vladimir',
            family: 'family_1',
            kind: 'birthday' satisfies DayAnnotationKind,
            title: 'День рождения Владимира',
            month: 3,
            day: 12,
            recurrence: 'yearly',
            color: 'blue',
            tone: 'positive',
            visibility: 'family',
            source: 'manual',
            readonly: false,
            person_name: 'Владимир',
            person_relation: 'коллега',
            person_contact: '+7 999 000-00-00',
            created_by: 'member_1'
          },
          {
            id: 'new_year_2026',
            family: 'family_1',
            kind: 'public_holiday' satisfies DayAnnotationKind,
            title: 'Новый год',
            month: 1,
            day: 1,
            year: 2026,
            recurrence: 'one_time',
            color: 'gray',
            tone: 'system',
            visibility: 'family',
            source: 'nager_date',
            readonly: true,
            country_code: 'RU',
            source_uid: 'RU-2026-01-01-NewYear',
            fetched_at: '2026-06-10T10:00:00.000Z'
          }
        ]
      })
    };
    const client = createFakeClient({ [COLLECTIONS.dayAnnotations]: dayAnnotations });
    setPocketBaseClient(client);

    const result = await listDayAnnotationsForYear(
      {
        familyId: 'family_1',
        memberId: 'member_1'
      },
      2026
    );

    expect(dayAnnotations.getList).toHaveBeenCalledWith(
      1,
      200,
      expect.objectContaining({
        filter: expect.stringContaining('family = "family_1"'),
        sort: 'month,day,title'
      })
    );
    expect(dayAnnotations.getList.mock.calls[0][2].filter).toContain('recurrence = "yearly"');
    expect(dayAnnotations.getList.mock.calls[0][2].filter).toContain('year = 2026');
    expect(result.items[0]).toMatchObject({
      id: 'birthday_vladimir',
      personName: 'Владимир',
      personRelation: 'коллега',
      personContact: '+7 999 000-00-00'
    });
    expect(result.totalItems).toBe(2);

    resetPocketBaseClient();
  });

  it('creates, updates and deletes manual day annotations with optional external contact fields', async () => {
    const createdRecord = {
      id: 'birthday_vladimir',
      family: 'family_1',
      kind: 'birthday',
      title: 'День рождения Владимира',
      month: 3,
      day: 12,
      recurrence: 'yearly',
      color: 'blue',
      tone: 'positive',
      visibility: 'family',
      source: 'manual',
      readonly: false,
      person_name: 'Владимир',
      person_relation: 'коллега',
      person_contact: '+7 999 000-00-00',
      created_by: 'member_1'
    };
    const dayAnnotations = {
      create: vi.fn().mockResolvedValue(createdRecord),
      update: vi.fn().mockResolvedValue({
        ...createdRecord,
        person_contact: ''
      }),
      delete: vi.fn().mockResolvedValue({})
    };
    const client = createFakeClient({ [COLLECTIONS.dayAnnotations]: dayAnnotations });
    setPocketBaseClient(client);

    const context = { familyId: 'family_1', memberId: 'member_1' };
    const created = await createDayAnnotation(
      {
        kind: 'birthday',
        title: 'День рождения Владимира',
        month: 3,
        day: 12,
        recurrence: 'yearly',
        color: 'blue',
        tone: 'positive',
        visibility: 'family',
        personName: 'Владимир',
        personRelation: 'коллега',
        personContact: '+7 999 000-00-00'
      },
      context
    );

    const updated = await updateDayAnnotation(
      'birthday_vladimir',
      {
        personContact: ''
      },
      context
    );
    await deleteDayAnnotation('birthday_vladimir', context);

    expect(dayAnnotations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'family_1',
        created_by: 'member_1',
        source: 'manual',
        person_name: 'Владимир',
        person_relation: 'коллега',
        person_contact: '+7 999 000-00-00'
      }),
      { headers: { 'X-Family-Member-Id': 'member_1' } }
    );
    expect(dayAnnotations.update).toHaveBeenCalledWith(
      'birthday_vladimir',
      { person_contact: '' },
      { headers: { 'X-Family-Member-Id': 'member_1' } }
    );
    expect(dayAnnotations.delete).toHaveBeenCalledWith(
      'birthday_vladimir',
      { headers: { 'X-Family-Member-Id': 'member_1' } }
    );
    expect(created.personContact).toBe('+7 999 000-00-00');
    expect(updated.personContact).toBeUndefined();

    resetPocketBaseClient();
  });

  it('loads activity feed and notification inbox records with member context', async () => {
    const activity = {
      getList: vi.fn().mockResolvedValue({
        page: 1,
        perPage: 30,
        totalItems: 1,
        totalPages: 1,
        items: [
          {
            id: 'activity_1',
            family: 'family_1',
            actor: 'member_child',
            action: 'assignment.done',
            summary: 'Готово: Вынести мусор',
            created: '2026-06-13T10:00:00.000Z'
          }
        ]
      })
    };
    const notifications = {
      getList: vi.fn().mockResolvedValue({
        page: 1,
        perPage: 50,
        totalItems: 1,
        totalPages: 1,
        items: [
          {
            id: 'note_1',
            family: 'family_1',
            recipient_member: 'member_parent',
            type: 'assignment.done_waiting_approval',
            title: 'Поручение ждёт проверки',
            body: 'Вынести мусор',
            occurrence: 'occ_1',
            read_at: '',
            created: '2026-06-13T10:01:00.000Z'
          }
        ]
      }),
      update: vi.fn().mockResolvedValue({
        id: 'note_1',
        family: 'family_1',
        recipient_member: 'member_parent',
        type: 'assignment.done_waiting_approval',
        title: 'Поручение ждёт проверки',
        body: 'Вынести мусор',
        occurrence: 'occ_1',
        read_at: '2026-06-13T10:05:00.000Z',
        created: '2026-06-13T10:01:00.000Z'
      })
    };
    const client = createFakeClient({
      [COLLECTIONS.itemActivity]: activity,
      [COLLECTIONS.notifications]: notifications
    });
    setPocketBaseClient(client);

    const context = { familyId: 'family_1', memberId: 'member_parent' };
    const feed = await listActivity(context);
    const inbox = await listNotifications(context);
    const unread = await listUnreadNotifications(context);
    const read = await markNotificationRead('note_1', context, '2026-06-13T10:05:00.000Z');
    await markAllNotificationsRead(context, '2026-06-13T10:05:00.000Z');

    expect(activity.getList).toHaveBeenCalledWith(
      1,
      30,
      expect.objectContaining({
        filter: 'family = "family_1"',
        sort: '-created',
        headers: { 'X-Family-Member-Id': 'member_parent' }
      })
    );
    expect(notifications.getList).toHaveBeenCalledWith(
      1,
      50,
      expect.objectContaining({
        filter: 'family = "family_1" && recipient_member = "member_parent"',
        sort: '-created',
        headers: { 'X-Family-Member-Id': 'member_parent' }
      })
    );
    expect(notifications.getList.mock.calls[1][2].filter).toContain('read_at = ""');
    expect(notifications.update).toHaveBeenCalledWith(
      'note_1',
      { read_at: '2026-06-13T10:05:00.000Z' },
      { headers: { 'X-Family-Member-Id': 'member_parent' } }
    );
    expect(feed[0].summary).toBe('Готово: Вынести мусор');
    expect(inbox[0].title).toBe('Поручение ждёт проверки');
    expect(unread).toHaveLength(1);
    expect(read.readAt).toBe('2026-06-13T10:05:00.000Z');

    resetPocketBaseClient();
  });

  it('subscribes realtime feeds with scoped filters and member headers', async () => {
    const unsubscribeNotifications = vi.fn();
    const unsubscribeActivity = vi.fn();
    const unsubscribeOccurrences = vi.fn();
    const notifications = {
      subscribe: vi.fn().mockResolvedValue(unsubscribeNotifications)
    };
    const activity = {
      subscribe: vi.fn().mockResolvedValue(unsubscribeActivity)
    };
    const occurrences = {
      subscribe: vi.fn().mockResolvedValue(unsubscribeOccurrences)
    };
    const client = createFakeClient({
      [COLLECTIONS.notifications]: notifications,
      [COLLECTIONS.itemActivity]: activity,
      [COLLECTIONS.itemOccurrences]: occurrences
    });
    setPocketBaseClient(client);

    const context = { familyId: 'family_1', memberId: 'member_parent' };
    const onNotificationsChange = vi.fn();
    const onActivityChange = vi.fn();
    const onOccurrencesChange = vi.fn();

    const notificationUnsubscribe = await subscribeNotifications(context, onNotificationsChange);
    const activityUnsubscribe = await subscribeActivity(context, onActivityChange);
    const occurrenceUnsubscribe = await subscribeOccurrencesInRange(
      context,
      {
        from: '2026-06-15T00:00:00.000Z',
        to: '2026-06-22T00:00:00.000Z'
      },
      onOccurrencesChange
    );

    notifications.subscribe.mock.calls[0][1]({ action: 'create' });
    activity.subscribe.mock.calls[0][1]({ action: 'create' });
    occurrences.subscribe.mock.calls[0][1]({ action: 'update' });
    notificationUnsubscribe();
    activityUnsubscribe();
    occurrenceUnsubscribe();

    expect(notifications.subscribe).toHaveBeenCalledWith(
      '*',
      expect.any(Function),
      expect.objectContaining({
        filter: 'family = "family_1" && recipient_member = "member_parent"',
        headers: { 'X-Family-Member-Id': 'member_parent' }
      })
    );
    expect(activity.subscribe).toHaveBeenCalledWith(
      '*',
      expect.any(Function),
      expect.objectContaining({
        filter: 'family = "family_1"',
        headers: { 'X-Family-Member-Id': 'member_parent' }
      })
    );
    expect(occurrences.subscribe).toHaveBeenCalledWith(
      '*',
      expect.any(Function),
      expect.objectContaining({
        headers: { 'X-Family-Member-Id': 'member_parent' }
      })
    );
    expect(occurrences.subscribe.mock.calls[0][2].filter).toContain('family = "family_1"');
    expect(occurrences.subscribe.mock.calls[0][2].filter).toContain(
      'start_at < "2026-06-22T00:00:00.000Z"'
    );
    expect(onNotificationsChange).toHaveBeenCalledTimes(1);
    expect(onActivityChange).toHaveBeenCalledTimes(1);
    expect(onOccurrencesChange).toHaveBeenCalledTimes(1);
    expect(unsubscribeNotifications).toHaveBeenCalledTimes(1);
    expect(unsubscribeActivity).toHaveBeenCalledTimes(1);
    expect(unsubscribeOccurrences).toHaveBeenCalledTimes(1);

    resetPocketBaseClient();
  });
});

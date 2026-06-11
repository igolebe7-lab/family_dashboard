import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import type { Family, FamilyMember } from '$lib/types/domain';
import { bootstrapFamilyContext } from './family.bootstrap';
import { createFamilyStore, getActiveFamilyContext } from './family.store';

const family: Family = {
  id: 'family_1',
  name: 'Дом',
  slug: 'dom',
  timezone: 'Europe/Amsterdam',
  ownerUser: 'user_1'
};

const member: FamilyMember = {
  id: 'member_1',
  family: 'family_1',
  user: 'user_1',
  displayName: 'Мама',
  role: 'owner',
  managedBy: [],
  active: true
};

describe('bootstrapFamilyContext', () => {
  it('loads families and members, then exposes active family context', async () => {
    const store = createFamilyStore();
    const listFamilies = vi.fn().mockResolvedValue([family]);
    const listMembersForFamily = vi.fn().mockResolvedValue([member]);

    const context = await bootstrapFamilyContext(store, {
      listFamilies,
      listMembersForFamily
    });

    expect(listFamilies).toHaveBeenCalledOnce();
    expect(listMembersForFamily).toHaveBeenCalledWith('family_1');
    expect(context).toEqual({
      familyId: 'family_1',
      memberId: 'member_1'
    });
    expect(getActiveFamilyContext(get(store))).toEqual(context);
    expect(get(store)).toMatchObject({
      status: 'ready',
      activeFamily: family,
      activeMember: member,
      error: null
    });
  });

  it('prefers the member linked to the authenticated user over alphabetical order', async () => {
    const store = createFamilyStore();
    const child: FamilyMember = {
      id: 'member_child',
      family: 'family_1',
      displayName: 'Аня',
      role: 'teen',
      managedBy: [],
      active: true
    };
    const parent: FamilyMember = {
      ...member,
      id: 'member_parent',
      displayName: 'Мама'
    };

    const context = await bootstrapFamilyContext(store, {
      listFamilies: vi.fn().mockResolvedValue([family]),
      listMembersForFamily: vi.fn().mockResolvedValue([child, parent]),
      preferredUserId: 'user_1'
    });

    expect(context).toEqual({
      familyId: 'family_1',
      memberId: 'member_parent'
    });
    expect(get(store).activeMember).toEqual(parent);
  });

  it('keeps a ready empty state when the user has no families yet', async () => {
    const store = createFamilyStore();

    const context = await bootstrapFamilyContext(store, {
      listFamilies: vi.fn().mockResolvedValue([]),
      listMembersForFamily: vi.fn()
    });

    expect(context).toBeNull();
    expect(get(store)).toMatchObject({
      status: 'ready',
      families: [],
      members: [],
      activeFamily: null,
      activeMember: null,
      error: null
    });
  });

  it('stores a user-facing error when bootstrap fails', async () => {
    const store = createFamilyStore();

    await expect(
      bootstrapFamilyContext(store, {
        listFamilies: vi.fn().mockRejectedValue(new Error('PocketBase unavailable')),
        listMembersForFamily: vi.fn()
      })
    ).rejects.toThrow('PocketBase unavailable');

    expect(get(store)).toMatchObject({
      status: 'error',
      error: 'Не удалось загрузить семейные данные'
    });
  });
});

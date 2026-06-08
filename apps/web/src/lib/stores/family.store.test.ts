import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import type { Family, FamilyMember } from '$lib/types/domain';
import { createFamilyStore, getActiveFamilyContext } from './family.store';

const familyOne: Family = {
  id: 'family_1',
  name: 'Дом',
  slug: 'dom',
  timezone: 'Europe/Amsterdam',
  ownerUser: 'user_1'
};

const familyTwo: Family = {
  id: 'family_2',
  name: 'Дача',
  slug: 'dacha',
  timezone: 'Europe/Amsterdam',
  ownerUser: 'user_1'
};

const parentMember: FamilyMember = {
  id: 'member_1',
  family: 'family_1',
  user: 'user_1',
  displayName: 'Мама',
  role: 'owner',
  managedBy: [],
  active: true
};

describe('createFamilyStore', () => {
  it('clears active member when the active family changes away from that member family', () => {
    const store = createFamilyStore();

    store.setFamilies([familyOne, familyTwo]);
    store.setMembers([parentMember]);
    expect(getActiveFamilyContext(get(store))).toEqual({
      familyId: 'family_1',
      memberId: 'member_1'
    });

    store.setActiveFamily(familyTwo);

    expect(get(store).activeMember).toBeNull();
    expect(getActiveFamilyContext(get(store))).toBeNull();
  });
});

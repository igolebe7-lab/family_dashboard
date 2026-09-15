import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { FamilyMember } from '$lib/types/domain';
import { createFamilyStore } from '$lib/stores/family.store';
import { getSelectableProfiles } from './profile-access';

const owner: FamilyMember = { id: 'igor', user: 'u1', family: 'f', displayName: 'Игорь', role: 'owner', active: true, managedBy: [] };
const parent: FamilyMember = { ...owner, id: 'katya', user: 'u2', role: 'parent' };
const child: FamilyMember = { ...owner, id: 'eva', user: 'u3', role: 'child', managedBy: [parent.id] };
const members = [owner, parent, child];

describe('authenticated profile selection', () => {
  it('offers own profile and managed children, never another adult', () => {
    expect(getSelectableProfiles(members, 'u1').map(m => m.id)).toEqual(['igor', 'eva']);
    expect(getSelectableProfiles(members, 'u2').map(m => m.id)).toEqual(['katya', 'eva']);
  });
  it('does not let a child select adults or siblings', () => {
    expect(getSelectableProfiles(members, 'u3')).toEqual([child]);
    expect(getSelectableProfiles(members, undefined)).toEqual([]);
  });
  it('excludes unmanaged children, inactive profiles and other families', () => {
    expect(getSelectableProfiles([parent, { ...child, managedBy: [] }, { ...child, id: 'inactive', active: false }, { ...child, id: 'foreign', family: 'other' }], 'u2')).toEqual([parent]);
  });
  it('guards the store and permits returning from a child to the authenticated parent', () => {
    const store = createFamilyStore(() => 'u1');
    store.setContext([], { id: 'f', name: 'Family', slug: 'f', timezone: 'UTC', ownerUser: 'u1' }, members, owner);
    store.setActiveMember(parent);
    expect(get(store).activeMember).toEqual(owner);
    store.setActiveMember(child);
    expect(get(store).activeMember).toEqual(child);
    store.setActiveMember(owner);
    expect(get(store).activeMember).toEqual(owner);
  });
});

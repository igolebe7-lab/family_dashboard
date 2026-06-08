import { describe, expect, it } from 'vitest';

import type { FamilyMember, Item } from '$lib/types/domain';
import { canViewItem } from './permissions';

const members = [
  member('owner', 'owner'),
  member('parent', 'parent', ['child']),
  member('adult', 'adult'),
  member('child', 'child'),
  member('other_child', 'child'),
  member('guest', 'guest'),
  member('external_parent', 'parent', [], 'other_family')
];

describe('canViewItem', () => {
  it('blocks records from another family', () => {
    const item = baseItem({ family: 'other_family', visibility: 'family' });

    expect(canViewItem(member('parent', 'parent'), item, members)).toBe(false);
  });

  it('hides adult-only items from children', () => {
    const item = baseItem({ visibility: 'adults' });

    expect(canViewItem(member('child', 'child'), item, members)).toBe(false);
    expect(canViewItem(member('adult', 'adult'), item, members)).toBe(true);
  });

  it('keeps private items visible only to creator, item owner, or family owner', () => {
    const item = baseItem({ visibility: 'private', createdBy: 'parent', owner: 'adult' });

    expect(canViewItem(member('parent', 'parent'), item, members)).toBe(true);
    expect(canViewItem(member('adult', 'adult'), item, members)).toBe(true);
    expect(canViewItem(member('owner', 'owner'), item, members)).toBe(true);
    expect(canViewItem(member('child', 'child'), item, members)).toBe(false);
  });

  it('lets parents see assignee-visible items for managed children', () => {
    const item = baseItem({
      visibility: 'assignees',
      assignees: ['child'],
      createdBy: 'adult'
    });

    expect(canViewItem(member('parent', 'parent', ['child']), item, members)).toBe(true);
    expect(canViewItem(member('other_child', 'child'), item, members)).toBe(false);
  });
});

function member(
  id: string,
  role: FamilyMember['role'],
  managedBy: string[] = [],
  family = 'family_1'
): FamilyMember {
  return {
    id,
    family,
    user: `${id}_user`,
    displayName: id,
    role,
    colorKey: 'green',
    managedBy,
    active: true
  };
}

function baseItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item_1',
    family: 'family_1',
    kind: 'assignment',
    title: 'Вынести мусор',
    createdBy: 'parent',
    assignees: [],
    participants: [],
    category: 'home',
    priority: 'normal',
    visibility: 'family',
    allDay: false,
    timezone: 'Europe/Amsterdam',
    approvalRequired: true,
    archived: false,
    ...overrides
  };
}

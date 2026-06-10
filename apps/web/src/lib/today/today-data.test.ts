import { describe, expect, it, vi } from 'vitest';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';
import { createTodayViewModelFromOccurrences, loadTodayViewModelFromOccurrences } from './today-data';

const context: ActiveFamilyContext = {
  familyId: 'family_1',
  memberId: 'member_misha'
};

const members: FamilyMember[] = [
  {
    id: 'member_misha',
    family: 'family_1',
    displayName: 'Миша',
    role: 'child',
    colorKey: 'green',
    managedBy: [],
    active: true
  },
  {
    id: 'member_mom',
    family: 'family_1',
    displayName: 'Мама',
    role: 'parent',
    colorKey: 'lavender',
    managedBy: [],
    active: true
  }
];

const schoolOccurrence: ItemOccurrence = {
  id: 'occ_school',
  family: 'family_1',
  item: 'item_school',
  visibleTo: ['member_misha'],
  kind: 'event',
  titleSnapshot: 'Школа',
  categorySnapshot: 'school',
  startAt: '2026-06-10T08:00:00.000+02:00',
  endAt: '2026-06-10T09:00:00.000+02:00',
  allDay: false,
  status: 'todo'
};

describe('today data adapter', () => {
  it('builds Today view model sections from occurrence records', () => {
    const model = createTodayViewModelFromOccurrences({
      date: new Date('2026-06-10T12:00:00.000Z'),
      occurrences: [schoolOccurrence],
      members
    });

    expect(model.familyMembers.map((member) => member.name)).toEqual(['Миша', 'Мама']);
    expect(model.weekEvents).toEqual([
      expect.objectContaining({
        id: 'occ_school',
        day: '2026-06-10',
        start: '08:00',
        durationMinutes: 60,
        title: 'Школа',
        memberName: 'Миша',
        color: 'green',
        icon: 'backpack'
      })
    ]);
    expect(model.timelineItems).toEqual([
      expect.objectContaining({
        id: 'occ_school',
        time: '08:00',
        title: 'Школа',
        subtitle: 'Миша',
        category: 'school',
        icon: 'backpack'
      })
    ]);
  });

  it('loads occurrences for the visible week range through the API boundary', async () => {
    const listOccurrencesInRange = vi.fn().mockResolvedValue({
      items: [schoolOccurrence],
      totalItems: 1
    });

    const model = await loadTodayViewModelFromOccurrences(context, {
      date: new Date('2026-06-10T12:00:00.000Z'),
      members,
      listOccurrencesInRange
    });

    expect(listOccurrencesInRange).toHaveBeenCalledWith(context, {
      from: '2026-06-08T00:00:00+02:00',
      to: '2026-06-14T23:59:59+02:00'
    });
    expect(model.weekEvents).toHaveLength(1);
  });
});

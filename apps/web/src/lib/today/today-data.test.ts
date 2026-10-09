import { describe, expect, it, vi } from 'vitest';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { FamilyMember, Item, ItemOccurrence } from '$lib/types/domain';
import { createTodayViewModelFromOccurrences, getTodayOccurrenceRange, loadTodayViewModelFromOccurrences } from './today-data';

const context: ActiveFamilyContext = {
  familyId: 'family_1',
  memberId: 'member_misha'
};

it('uses the viewer timezone for times and calendar days, not the browser zone', () => {
  const occurrence = { ...schoolOccurrence, startAt: '2026-06-10T22:30:00Z', endAt: '2026-06-10T23:30:00Z' };
  const moscow = createTodayViewModelFromOccurrences({ date: new Date(2026, 5, 11), occurrences: [occurrence], timezone: 'Europe/Moscow' });
  expect(moscow.timelineItems[0]?.time).toBe('01:30');
  expect(moscow.weekEvents[0].day).toBe('2026-06-11');
  const ny = createTodayViewModelFromOccurrences({ date: new Date(2026, 5, 10), occurrences: [occurrence], timezone: 'America/New_York' });
  expect(ny.timelineItems[0]?.time).toBe('18:30');
});

it('keeps all-day civil dates unchanged between accounts and includes the first day of a week', () => {
  const occurrence = { ...schoolOccurrence, allDay: true, startAt: '2026-06-07T21:00:00Z', endAt: '2026-06-08T20:59:59Z',
    itemRecord: { ...itemFor(schoolOccurrence), timezone: 'Europe/Moscow' } };
  for (const timezone of ['Europe/Moscow', 'America/New_York']) {
    const model = createTodayViewModelFromOccurrences({ date: new Date(2026, 5, 8), timezone, occurrences: [occurrence] });
    expect(model.allDayItems).toHaveLength(1);
    expect(model.weekEvents[0].day).toBe('2026-06-08');
  }
});
it('loads the viewer week across a DST change instead of using fixed UTC offsets', () => {
  expect(getTodayOccurrenceRange(new Date(2026, 2, 25), 'week', 'Europe/Amsterdam')).toEqual({
    from: '2026-03-22T23:00:00.000Z', to: '2026-03-29T21:59:59.999Z'
  });
});

const members: FamilyMember[] = [
  {
    id: 'member_misha',
    family: 'family_1',
    displayName: 'Миша',
    role: 'child',
    colorKey: 'green',
    managedBy: ['member_mom'],
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

const doneAssignmentOccurrence: ItemOccurrence = {
  id: 'occ_trash',
  family: 'family_1',
  item: 'item_trash',
  visibleTo: ['member_misha'],
  kind: 'assignment',
  titleSnapshot: 'Вынести мусор',
  categorySnapshot: 'home',
  dueAt: '2026-06-10T09:00:00.000+02:00',
  allDay: false,
  status: 'done',
  completedBy: 'member_misha',
  completedAt: '2026-06-10T08:30:00.000+02:00'
};

const overdueAssignmentOccurrence: ItemOccurrence = {
  id: 'occ_room',
  family: 'family_1',
  item: 'item_room',
  visibleTo: ['member_misha'],
  kind: 'assignment',
  titleSnapshot: 'Убрать комнату',
  categorySnapshot: 'home',
  dueAt: '2026-06-10T08:00:00.000+02:00',
  allDay: false,
  status: 'assigned'
};

const tomorrowTrainingOccurrence: ItemOccurrence = {
  id: 'occ_training',
  family: 'family_1',
  item: 'item_training',
  visibleTo: ['member_misha'],
  kind: 'event',
  titleSnapshot: 'Тренировка',
  categorySnapshot: 'sport',
  startAt: '2026-06-11T18:00:00.000+02:00',
  endAt: '2026-06-11T19:00:00.000+02:00',
  allDay: false,
  status: 'todo'
};

function itemFor(occurrence: ItemOccurrence): Item {
  return {
    id: occurrence.item, family: occurrence.family, kind: occurrence.kind, title: occurrence.titleSnapshot,
    createdBy: 'member_mom', participants: occurrence.kind === 'event' ? ['member_misha'] : [],
    assignees: occurrence.kind === 'assignment' ? ['member_misha'] : [], visibleTo: members.map(member => member.id),
    category: occurrence.categorySnapshot, priority: 'normal', visibility: 'family',
    allDay: false, timezone: 'Europe/Amsterdam', approvalRequired: true, archived: false
  };
}
for (const occurrence of [schoolOccurrence, doneAssignmentOccurrence, overdueAssignmentOccurrence, tomorrowTrainingOccurrence]) {
  occurrence.itemRecord = itemFor(occurrence);
}

describe('today data adapter', () => {
  it('keeps all-day metadata for the mobile week agenda', () => {
    const model = createTodayViewModelFromOccurrences({
      date: new Date(2026, 5, 10), members,
      occurrences: [schoolOccurrence, { ...schoolOccurrence, id: 'all-day', allDay: true }]
    });
    expect(model.weekEvents.find(event => event.id === 'all-day')).toMatchObject({ allDay: true });
    expect(model.weekEvents.find(event => event.id === schoolOccurrence.id)).toMatchObject({ allDay: false });
  });
  it('attributes completion to the actual actor rather than the assignee or readers', () => {
    const model = createTodayViewModelFromOccurrences({
      date: new Date(2026, 5, 10), members, activeMemberId: 'member_mom',
      occurrences: [{ ...doneAssignmentOccurrence, completedBy: 'member_mom' }]
    });
    expect(model.attentionItems[0].memberName).toBe('Мама');
    expect(model.attentionItems[0].body).toContain('Мама отметил');
  });
  it('uses actual participants rather than readers and never requests approval without metadata', () => {
    const model = createTodayViewModelFromOccurrences({
      date: new Date(2026, 5, 10), members, activeMemberId: 'member_mom',
      occurrences: [{ ...tomorrowTrainingOccurrence, visibleTo: members.map(member => member.id),
        itemRecord: { ...itemFor(tomorrowTrainingOccurrence), approvalRequired: false } },
        { ...doneAssignmentOccurrence, itemRecord: undefined }]
    });
    expect(model.weekEvents[1]?.memberName ?? model.weekEvents[0]?.memberName).toBe('Миша');
    expect(model.attentionItems.some(item => item.actionKind === 'approve_assignment')).toBe(false);
    expect(model.attentionItems.some(item => item.body.includes('Вся семьи'))).toBe(false);
  });
  it('keeps the entire displayed month including adjacent grid days', async () => {
    const listOccurrencesInRange = vi.fn().mockResolvedValue({
      items: [{ ...schoolOccurrence, startAt: '2026-06-29T08:00:00+02:00' }], totalItems: 1
    });
    const model = await loadTodayViewModelFromOccurrences(context, {
      date: new Date(2026, 5, 10), view: 'month', listOccurrencesInRange
    });
    expect(listOccurrencesInRange).toHaveBeenCalledWith(context, {
      from: '2026-06-01T00:00:00+02:00', to: '2026-07-05T23:59:59+02:00'
    });
    expect(model.weekEvents).toHaveLength(1);
    expect(model.timelineItems).toEqual([]);
    expect(model.feedItems).toEqual([]);
    expect(model.familyMembers).toEqual([]);
  });

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

  it('builds attention items from assignments waiting approval, overdue work, and prep reminders', () => {
    const model = createTodayViewModelFromOccurrences({
      date: new Date('2026-06-10T12:00:00.000+02:00'),
      occurrences: [doneAssignmentOccurrence, overdueAssignmentOccurrence, tomorrowTrainingOccurrence],
      activeMemberId: 'member_mom',
      members
    });

    expect(model.attentionItems).toEqual([
      expect.objectContaining({
        id: 'attention-approval-occ_trash',
        occurrenceId: 'occ_trash',
        actionKind: 'approve_assignment',
        body: 'Миша отметил «Вынести мусор» как готово',
        memberName: 'Миша',
        color: 'green',
        actionLabel: 'Подтвердить',
        secondaryActionLabel: 'Вернуть'
      }),
      expect.objectContaining({
        id: 'attention-overdue-occ_room',
        body: 'Просрочено: Миша — «Убрать комнату»',
        memberName: 'Миша',
        color: 'green',
        actionLabel: 'Открыть'
      }),
      expect.objectContaining({
        id: 'attention-prep-occ_training',
        body: 'Завтра: «Тренировка» — Миша',
        memberName: 'Миша',
        color: 'green',
        actionLabel: 'Открыть событие'
      })
    ]);
    expect(model.attentionCount).toBe(3);
  });

  it('adds a soft Done action for active assignment occurrences', () => {
    const model = createTodayViewModelFromOccurrences({
      date: new Date('2026-06-10T12:00:00.000+02:00'),
      occurrences: [overdueAssignmentOccurrence],
      activeMemberId: 'member_misha',
      members
    });

    expect(model.timelineItems).toEqual([
      expect.objectContaining({
        id: 'occ_room',
        kind: 'assignment',
        actionKind: 'mark_assignment_done',
        actionLabel: 'Я сделал'
      })
    ]);
  });

  it('loads occurrences for the visible week range through the API boundary', async () => {
    const listOccurrencesInRange = vi.fn().mockResolvedValue({
      items: [schoolOccurrence, doneAssignmentOccurrence],
      totalItems: 2
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
    expect(model.weekEvents.map((event) => event.id)).toEqual(['occ_school', 'occ_trash']);
    expect(model.attentionItems).toHaveLength(0);
  });

  it('allows a managing parent to complete but never lets a child approve or a reader complete', () => {
    const model = (memberId: string, occurrences = [overdueAssignmentOccurrence, doneAssignmentOccurrence]) => createTodayViewModelFromOccurrences({
      date: new Date(2026, 5, 10), occurrences, members, activeMemberId: memberId
    });
    expect(model('member_mom').timelineItems.find(item => item.id === 'occ_room')?.actionKind).toBe('mark_assignment_done');
    expect(model('member_misha').attentionItems.some(item => item.actionKind === 'approve_assignment')).toBe(false);
    expect(model('unknown').timelineItems.every(item => !item.actionKind)).toBe(true);
    const noApproval = { ...doneAssignmentOccurrence, itemRecord: { ...itemFor(doneAssignmentOccurrence), approvalRequired: false } };
    expect(model('member_mom', [noApproval]).attentionItems).toEqual([]);
  });
});

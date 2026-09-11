import { describe, expect, it } from 'vitest';

import type { FamilyMember, Item, ItemOccurrence } from '$lib/types/domain';
import {
  createAssignmentViewModels,
  createChildModeViewModel,
  createTaskViewModels,
  filterWorkCards,
  getChildModeAccess,
  mapActivityToFeedItem,
  mapNotificationInboxItem
} from './assignments-view';

const members: FamilyMember[] = [
  {
    id: 'parent',
    family: 'family_1',
    displayName: 'Мама',
    role: 'parent',
    colorKey: 'lavender',
    managedBy: [],
    active: true
  },
  {
    id: 'child',
    family: 'family_1',
    displayName: 'Миша',
    role: 'child',
    colorKey: 'green',
    managedBy: ['parent'],
    active: true
  }
];

const assignment: ItemOccurrence = {
  id: 'occ_trash',
  family: 'family_1',
  item: 'item_trash',
  visibleTo: ['parent', 'child'],
  kind: 'assignment',
  titleSnapshot: 'Вынести мусор',
  categorySnapshot: 'home',
  dueAt: '2026-06-13T18:00:00.000+02:00',
  allDay: false,
  status: 'done',
  completedBy: 'child',
  completedAt: '2026-06-13T17:20:00.000+02:00'
};

const item: Item = {
  id: 'item_trash', family: 'family_1', kind: 'assignment', title: 'Вынести мусор',
  createdBy: 'parent', assignees: ['child'], participants: [], visibleTo: ['parent', 'child'],
  category: 'home', priority: 'normal', visibility: 'assignees', allDay: false,
  timezone: 'Europe/Amsterdam', approvalRequired: true, archived: false
};

const event: ItemOccurrence = {
  id: 'occ_school',
  family: 'family_1',
  item: 'item_school',
  visibleTo: ['child'],
  kind: 'event',
  titleSnapshot: 'Школа',
  categorySnapshot: 'school',
  startAt: '2026-06-13T08:00:00.000+02:00',
  endAt: '2026-06-13T09:00:00.000+02:00',
  allDay: false,
  status: 'todo'
};

describe('assignments view models', () => {
  it('maps assignment occurrences to parent review actions', () => {
    const [model] = createAssignmentViewModels({
      occurrences: [assignment],
      items: [item],
      members,
      activeMemberId: 'parent'
    });

    expect(model).toEqual(
      expect.objectContaining({
        id: 'occ_trash',
        title: 'Вынести мусор',
        assigneeName: 'Миша',
        statusLabel: 'Ждёт проверки',
        primaryAction: 'approve_assignment',
        primaryLabel: 'Подтвердить',
        secondaryAction: 'reject_assignment',
        secondaryLabel: 'Вернуть'
      })
    );
  });

  it('builds a child mode model with simple labels and schedule', () => {
    const model = createChildModeViewModel({
      occurrences: [assignment, event],
      items: [item, { ...item, id: 'item_school', kind: 'event', participants: ['child'] }],
      members,
      activeMemberId: 'child',
      date: new Date('2026-06-13T12:00:00.000+02:00')
    });

    expect(model.assignmentCards).toEqual([
      expect.objectContaining({
        title: 'Вынести мусор',
        statusLabel: 'Ждёт проверки',
        primaryAction: undefined
      })
    ]);
    expect(model.scheduleItems).toEqual([
      expect.objectContaining({
        title: 'Школа',
        time: '08:00'
      })
    ]);
  });

  it('does not infer assignment permissions or assignees from visibleTo', () => {
    const [missing] = createAssignmentViewModels({ occurrences: [assignment], members, activeMemberId: 'parent' });
    expect(missing.primaryAction).toBeUndefined();
    expect(missing.assigneeName).toBe('Исполнитель недоступен');
    const [unrelated] = createAssignmentViewModels({
      occurrences: [{ ...assignment, status: 'assigned' }], items: [{ ...item, assignees: ['other'] }], members, activeMemberId: 'parent'
    });
    expect(unrelated.primaryAction).toBeUndefined();
  });

  it('allows managed-child completion but not review by an unrelated adult', () => {
    const [parent] = createAssignmentViewModels({ occurrences: [{ ...assignment, status: 'assigned' }], items: [item], members, activeMemberId: 'parent' });
    expect(parent.primaryAction).toBe('mark_assignment_done');
    expect(parent.assigneeName).toBe('Миша');
    const [adult] = createAssignmentViewModels({ occurrences: [assignment], items: [item], members: [...members, { ...members[0], id: 'adult', role: 'adult' }], activeMemberId: 'adult' });
    expect(adult.primaryAction).toBeUndefined();
  });

  it('treats done without approval as completed and hides review actions', () => {
    const [card] = createAssignmentViewModels({ occurrences: [assignment], items: [{ ...item, approvalRequired: false }], members, activeMemberId: 'parent' });
    expect(card.statusLabel).toBe('Готово');
    expect(card.group).toBe('completed');
    expect(card.primaryAction).toBeUndefined();
  });

  it('fails closed without an active child and never exposes unrelated or adult items', () => {
    const input = { occurrences: [assignment, event], items: [item], members };
    expect(createChildModeViewModel(input).assignmentCards).toEqual([]);
    expect(createChildModeViewModel({ ...input, activeMemberId: 'parent' }).scheduleItems).toEqual([]);
    for (const restricted of [{ ...item, visibility: 'adults' as const }, { ...item, assignees: ['other'] }, { ...item, family: 'other' }]) {
      expect(createChildModeViewModel({ ...input, items: [restricted], activeMemberId: 'child' }).assignmentCards).toEqual([]);
    }
  });

  it('never grants child review and includes only today events in family timezone', () => {
    const input = { occurrences: [assignment, { ...event, startAt: '2026-06-12T23:30:00Z', endAt: '2026-06-13T01:00:00Z' }], items: [item, { ...item, id: 'item_school', kind: 'event' as const, participants: ['child'] }], members, activeMemberId: 'child', date: new Date('2026-06-13T12:00:00Z'), timezone: 'Europe/Amsterdam' };
    const result = createChildModeViewModel(input);
    expect(result.assignmentCards[0].secondaryAction).toBeUndefined();
    expect(result.scheduleItems[0].time).toBe('01:30');
  });

  it('maps notifications and activity records for inbox and feed screens', () => {
    expect(
      mapNotificationInboxItem({
        id: 'note_1',
        family: 'family_1',
        recipientMember: 'parent',
        type: 'assignment.done_waiting_approval',
        title: 'Поручение ждёт проверки',
        body: 'Вынести мусор',
        occurrence: 'occ_trash',
        created: '2026-06-13T10:00:00.000Z'
      })
    ).toEqual(
      expect.objectContaining({
        id: 'note_1',
        unread: true,
        actionLabel: 'Открыть поручение'
      })
    );

    expect(
      mapActivityToFeedItem(
        {
          id: 'activity_1',
          family: 'family_1',
          actor: 'child',
          action: 'assignment.done',
          summary: 'Готово: Вынести мусор',
          created: '2026-06-13T10:00:00.000Z'
        },
        members
      )
    ).toEqual(
      expect.objectContaining({
        id: 'activity_1',
        actorName: 'Миша',
        summary: 'Готово: Вынести мусор'
      })
    );
  });

  it('filters real status groups, member assignment and case-insensitive title', () => {
    const cards = createAssignmentViewModels({ occurrences: [assignment, { ...assignment, id: 'open', status: 'assigned' }, { ...assignment, id: 'cancelled', status: 'cancelled' }], items: [item], members, activeMemberId: 'parent' });
    expect(filterWorkCards(cards, 'review', 'child', 'МУСОР').map((card) => card.id)).toEqual(['occ_trash']);
    expect(filterWorkCards(cards, 'all', 'parent')).toEqual([]);
    expect(filterWorkCards(cards, 'cancelled')).toHaveLength(1);
    expect(filterWorkCards(cards, 'open')[0].id).toBe('open');
  });

  it('allows only active owned tasks to be completed and tolerates invalid dates', () => {
    const cards = createTaskViewModels({ occurrences: ['todo', 'done', 'cancelled'].map((status) => ({ ...assignment, id: status, kind: 'task', status: status as 'todo' | 'done' | 'cancelled', dueAt: 'bad-date' })), items: [{ ...item, kind: 'task', owner: 'parent', approvalRequired: false }], members, activeMemberId: 'parent' });
    expect(cards.find((card) => card.id === 'todo')?.primaryAction).toBe('mark_assignment_done');
    expect(cards.find((card) => card.id === 'cancelled')?.primaryAction).toBeUndefined();
    expect(cards.find((card) => card.id === 'done')?.group).toBe('completed');
    expect(cards.every((card) => card.dueLabel === 'Без срока')).toBe(true);
  });

  it('does not let a parent complete a child personal task they did not create', () => {
    const [card] = createTaskViewModels({ occurrences: [{ ...assignment, kind: 'task', status: 'todo' }], items: [{ ...item, kind: 'task', owner: 'child', createdBy: 'child', visibility: 'family' }], members, activeMemberId: 'parent' });
    expect(card.primaryAction).toBeUndefined();
  });

  it('offers managed children using the authenticated account, not the active role', () => {
    const familyMembers: FamilyMember[] = [
      { ...members[0], user: 'parent-user' }, { ...members[1], user: 'child-user' },
      { ...members[1], id: 'sibling', managedBy: ['other'] },
      { ...members[1], id: 'inactive', active: false },
      { ...members[1], id: 'foreign', family: 'foreign' }
    ];
    const parent = getChildModeAccess(familyMembers, 'parent-user', 'family_1');
    expect(parent.children.map((member) => member.id)).toEqual(['child']);
    expect(parent.adult?.id).toBe('parent');
    expect(getChildModeAccess(familyMembers, 'child-user', 'family_1').children.map((member) => member.id)).toEqual(['child']);
    expect(getChildModeAccess(familyMembers, 'child-user', 'family_1').adult).toBeUndefined();
    expect(getChildModeAccess(familyMembers, 'child-user', 'family_1').selectedChild?.id).toBe('child');
    expect(getChildModeAccess(familyMembers, 'parent-user', 'family_1').selectedChild).toBeUndefined();
    expect(getChildModeAccess(familyMembers, 'parent-user', 'family_1', 'child').selectedChild?.id).toBe('child');
    expect(getChildModeAccess(familyMembers, 'parent-user', 'family_1', 'sibling').selectedChild).toBeUndefined();
    expect(getChildModeAccess(familyMembers, undefined, 'family_1').children).toEqual([]);
    expect(getChildModeAccess(familyMembers, 'outsider', 'family_1').children).toEqual([]);
    expect(getChildModeAccess([{ ...familyMembers[0], role: 'owner' }, ...familyMembers.slice(1)], 'parent-user', 'family_1').children.map((member) => member.id)).toEqual(['child', 'sibling']);
  });
});

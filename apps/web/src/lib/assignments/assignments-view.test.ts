import { describe, expect, it } from 'vitest';

import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';
import {
  createAssignmentViewModels,
  createChildModeViewModel,
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
});

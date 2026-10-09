import { expect, it } from 'vitest';
import { canEditWorkChecklist, latestWorkOccurrence } from './work-progress';
import type { FamilyMember, Item, ItemOccurrence } from '$lib/types/domain';

it('does not replace approved realtime state with a delayed Done response', () => {
  const approved: ItemOccurrence = { id: 'o', family: 'f', item: 'i', kind: 'assignment', titleSnapshot: 'Дело', categorySnapshot: 'home', visibleTo: [], allDay: false, updated: '2026-10-09 12:00:00.002Z', status: 'approved' };
  const delayed: ItemOccurrence = { ...approved, updated: '2026-10-09 12:00:00.001Z', status: 'done' };
  expect(latestWorkOccurrence(approved, delayed)).toBe(approved);
  expect(latestWorkOccurrence(delayed, approved)).toBe(approved);
});
it('lets the creator edit an open checklist without allowing an unrelated viewer', () => {
  const actor: FamilyMember = { id: 'a', family: 'f', active: true, role: 'adult', displayName: 'Взрослый', managedBy: [] };
  const item: Item = { id: 'i', title: 'Дело', category: 'home', priority: 'normal', allDay: false, timezone: 'UTC', approvalRequired: false, visibleTo: [], family: 'f', kind: 'assignment', archived: false, createdBy: 'a', assignees: ['b'], participants: [], visibility: 'family' };
  const row: ItemOccurrence = { id: 'o', family: 'f', item: 'i', kind: 'assignment', titleSnapshot: 'Дело', categorySnapshot: 'home', visibleTo: [], allDay: false, status: 'assigned' };
  expect(canEditWorkChecklist(actor, item, [actor], row)).toBe(true);
  expect(canEditWorkChecklist({ ...actor, id: 'viewer' }, item, [actor], row)).toBe(false);
  expect(canEditWorkChecklist(actor, item, [actor], { ...row, status: 'done' })).toBe(false);
  expect(canEditWorkChecklist(actor, { ...item, archived: true }, [actor], row)).toBe(false);
});

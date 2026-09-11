import { describe, expect, it } from 'vitest';
import { mapOccurrenceRecord } from '$lib/api/occurrences.api';
import type { FamilyMember, ItemKind, ItemPriority, OccurrenceStatus } from '$lib/types/domain';
import { buildAttentionSummary, nextAttentionDayBoundary } from './attention-summary';

const now = new Date('2026-09-11T12:00:00Z');
const members: FamilyMember[] = [
  { id: 'parent', family: 'f', displayName: 'Игорь', role: 'owner', active: true, managedBy: [] },
  { id: 'child', family: 'f', displayName: 'Ева', role: 'child', active: true, managedBy: ['parent'] }
];
function row(id: string, kind: ItemKind, due: string, priority: ItemPriority = 'normal', status: OccurrenceStatus = 'todo', archived = false) {
  return mapOccurrenceRecord({ id, item: id, family: 'f', kind, status, due_at: kind === 'event' ? '' : due, start_at: kind === 'event' ? due : '',
    title_snapshot: id, expand: { item: { id, family: 'f', kind, title: id, priority, archived, created_by: 'parent', owner: 'parent',
      assignees: kind === 'assignment' ? ['child'] : [], participants: [], approval_required: true, visibility: 'family' } } });
}
describe('attention summary relative to now', () => {
  it('refreshes at family midnight across DST transitions', () => {
    expect(new Date(nextAttentionDayBoundary(new Date('2026-03-29T00:30:00Z'), 'Europe/Amsterdam')).toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(new Date(nextAttentionDayBoundary(new Date('2026-10-25T00:30:00Z'), 'Europe/Amsterdam')).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });
  it('orders approval, old unresolved work and seven-day important records; separates tomorrow', () => {
    const records = [row('high', 'event', '2026-09-13T12:00:00Z', 'high'), row('urgent', 'task', '2026-09-15T12:00:00Z', 'urgent'),
      row('old', 'task', '2025-01-01T12:00:00Z'), row('approval', 'assignment', '2025-01-01T12:00:00Z', 'normal', 'done'),
      row('tomorrow', 'event', '2026-09-12T12:00:00Z'), row('tomorrow-task', 'task', '2026-09-12T13:00:00Z'),
      row('later', 'event', '2026-09-20T12:00:00Z', 'urgent')];
    const result = buildAttentionSummary(records, members, 'parent', now, 'Europe/Amsterdam');
    expect(result.attention.map(item => item.itemId)).toEqual(['approval', 'old', 'urgent', 'high']);
    expect(result.tomorrow.map(item => item.itemId)).toEqual(['tomorrow', 'tomorrow-task']);
    expect(result.attention[0].actionKind).toBe('approve_assignment');
  });
  it('excludes terminal and archived records and hides approval actions from children', () => {
    const records = [row('done', 'task', '2026-09-12T12:00:00Z', 'urgent', 'done'),
      row('cancelled', 'event', '2026-09-12T12:00:00Z', 'urgent', 'cancelled'),
      row('approved', 'assignment', '2026-09-12T12:00:00Z', 'urgent', 'approved'),
      row('archived', 'task', '2026-09-12T12:00:00Z', 'urgent', 'todo', true),
      row('awaiting', 'assignment', '2026-09-12T12:00:00Z', 'normal', 'done')];
    expect(buildAttentionSummary(records, members, 'child', now, 'Europe/Amsterdam')).toEqual({ attention: [], tomorrow: [] });
  });
  it('uses family timezone for tomorrow and deduplicates occurrences', () => {
    const record = row('next', 'event', '2026-09-12T00:30:00Z');
    expect(buildAttentionSummary([record, record], members, 'parent', new Date('2026-09-11T22:30:00Z'), 'America/New_York').tomorrow).toHaveLength(0);
    expect(buildAttentionSummary([record, record], members, 'parent', now, 'UTC').tomorrow).toHaveLength(1);
  });
});

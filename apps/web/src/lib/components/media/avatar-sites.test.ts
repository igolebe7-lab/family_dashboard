import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { FamilyMember, Item, ItemOccurrence } from '$lib/types/domain';
import { createAssignmentViewModels } from '$lib/assignments/assignments-view';
import { createTodayViewModelFromOccurrences } from '$lib/today/today-data';
import { buildAttentionSummary } from '$lib/today/attention-summary';
import { createComposerFormValues } from '$lib/composer/composer-form';
import AssignmentCard from '$lib/components/assignments/AssignmentCard.svelte';
import AttentionPanel from '$lib/components/today/AttentionPanel.svelte';
import CalendarEventCard from '$lib/components/today/CalendarEventCard.svelte';
import TaskForm from '$lib/components/composer/TaskForm.svelte';

const parent: FamilyMember = { id: 'parent', family: 'family', displayName: 'Родитель', role: 'parent', active: true, colorKey: 'blue', managedBy: [] };
const child: FamilyMember = { ...parent, id: 'child', displayName: 'Ребёнок', role: 'child', colorKey: 'peach', avatar: 'cropped.jpg', managedBy: ['parent'] };
const members = [parent, child];
const item: Item = { id: 'item', family: 'family', kind: 'assignment', title: 'Дело', createdBy: 'parent', assignees: ['child'], participants: [], visibleTo: ['parent', 'child'], category: 'home', priority: 'normal', visibility: 'family', allDay: false, timezone: 'UTC', approvalRequired: true, archived: false };
const occurrence: ItemOccurrence = { id: 'occurrence', family: 'family', item: 'item', itemRecord: item, visibleTo: ['parent', 'child'], kind: 'assignment', titleSnapshot: 'Дело', categorySnapshot: 'home', dueAt: '2026-10-10T08:00:00Z', allDay: false, status: 'done', completedBy: 'child' };
const now = new Date('2026-10-10T12:00:00Z');

describe('shared avatars at common sites', () => {
  it('keeps assignment identity and controls while rendering the resolved assignee avatar', () => {
    const [card] = createAssignmentViewModels({ occurrences: [occurrence], items: [item], members, activeMemberId: 'parent' });
    const { body } = render(AssignmentCard, { props: { card } });
    expect(body).toContain('profile-avatar__circle');
    expect(body).toContain('protected-image');
    expect(body).toContain('--avatar-size: 48px');
    expect(body).toContain('var(--color-peach');
    expect(body).toContain('Ребёнок');
    expect(body).toContain('aria-label="Подтвердить: Дело"');
  });
  it('keeps the unavailable-member fallback instead of selecting an unrelated profile', () => {
    const [card] = createAssignmentViewModels({ occurrences: [occurrence], items: [item], members: [parent], activeMemberId: 'parent' });
    const { body } = render(AssignmentCard, { props: { card } });
    expect(body).not.toContain('profile-avatar');
    expect(body).toContain('Исполнитель недоступен');
  });
  it('passes avatars through both attention model builders without changing approve semantics', () => {
    const model = createTodayViewModelFromOccurrences({ date: now, timezone: 'UTC', occurrences: [occurrence], members, activeMemberId: 'parent' });
    const summary = buildAttentionSummary([occurrence], members, 'parent', now, 'UTC');
    for (const items of [model.attentionItems, summary.attention]) {
      const { body } = render(AttentionPanel, { props: { items } });
      expect(body).toContain('profile-avatar__circle');
      expect(body).toContain('protected-image');
      expect(body).toContain('Подтвердить');
      expect(body).toContain('Вернуть');
    }
  });
  it('keeps category colour and event link while displaying the participant photo', () => {
    const eventOccurrence: ItemOccurrence = { ...occurrence, kind: 'event', status: 'todo', startAt: '2026-10-10T08:00:00Z', endAt: '2026-10-10T10:00:00Z', itemRecord: { ...item, kind: 'event', assignees: [], participants: ['child'] } };
    const [event] = createTodayViewModelFromOccurrences({ date: now, timezone: 'UTC', occurrences: [eventOccurrence], members }).weekEvents;
    const { body } = render(CalendarEventCard, { props: { event } });
    expect(body).toContain('profile-avatar__circle');
    expect(body).toContain('--avatar-size: 24px');
    expect(body).toContain('href="/app/items/item"');
    expect(body).toContain(`event-${event.color}`);
    const compact = render(CalendarEventCard, { props: { event: { ...event, durationMinutes: 60 }, positionStyle: 'height:76px' } }).body;
    expect(compact).not.toContain('profile-avatar');
  });
  it('does not turn an all-family event into a single-person avatar', () => {
    const record = { ...occurrence, kind: 'event' as const, startAt: '2026-10-10T08:00:00Z', itemRecord: { ...item, kind: 'event' as const, participants: ['parent', 'child'] } };
    const [event] = createTodayViewModelFromOccurrences({ date: now, timezone: 'UTC', occurrences: [record], members }).weekEvents;
    expect(render(CalendarEventCard, { props: { event } }).body).not.toContain('profile-avatar');
  });
  it('keeps named native radio inputs and 28px avatars in the executor picker', () => {
    const values = createComposerFormValues({ kind: 'task', activeMemberId: 'parent', date: now });
    const { body } = render(TaskForm, { props: { values, members } });
    expect(body.match(/profile-avatar__circle/g)).toHaveLength(2);
    expect(body).toContain('--avatar-size: 28px');
    expect(body).toContain('type="radio" name="work-target" value="child"');
    expect(body).toContain('Ребёнок');
    expect(body).toContain('Общее дело');
  });
  it('does not attach a profile from another family to an occurrence', () => {
    const mixedMembers = [parent, { ...child, family: 'other-family' }];
    const [card] = createAssignmentViewModels({ occurrences: [occurrence], items: [item], members: mixedMembers, activeMemberId: 'parent' });
    expect(card.member).toBeUndefined();
    const model = createTodayViewModelFromOccurrences({ date: now, timezone: 'UTC', occurrences: [occurrence], members: mixedMembers, activeMemberId: 'parent' });
    expect(model.weekEvents[0].member).toBeUndefined();
    expect(model.attentionItems.every(row => !row.member)).toBe(true);
    expect(buildAttentionSummary([occurrence], mixedMembers, 'parent', now, 'UTC').attention.every(row => !row.member)).toBe(true);
  });
});

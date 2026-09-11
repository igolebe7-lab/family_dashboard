import { createAssignmentViewModels } from '$lib/assignments/assignments-view';
import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';
import type { TodayAttentionItem } from './today-view-model';
import type { AccentColor } from '$lib/constants/colors';
import { createDateTimeIso } from '$lib/composer/composer-form';

export function nextAttentionDayBoundary(now: Date, timezone: string): number {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const next = new Date(`${key}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return Date.parse(createDateTimeIso(next.toISOString().slice(0, 10), '00:00', timezone));
}

export type AttentionSummary = { attention: TodayAttentionItem[]; tomorrow: TodayAttentionItem[] };
export function buildAttentionSummary(occurrences: ItemOccurrence[], members: FamilyMember[], memberId: string, now: Date, timezone: string): AttentionSummary {
  const horizon = now.getTime() + 7 * 86400000;
  const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const next = new Date(`${dateKey(now)}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const tomorrowKey = next.toISOString().slice(0, 10);
  const actions = new Map(createAssignmentViewModels({ occurrences,
    items: occurrences.flatMap(row => row.itemRecord ? [row.itemRecord] : []), members, activeMemberId: memberId
  }).map(card => [card.id, card.primaryAction]));
  const attention: Array<{ row: TodayAttentionItem; group: number; priority: number; due: number }> = [];
  const tomorrow: Array<{ row: TodayAttentionItem; due: number }> = [];
  const seen = new Set<string>();
  for (const occurrence of occurrences) {
    const item = occurrence.itemRecord;
    if (!item || item.archived || ['approved', 'cancelled', 'skipped'].includes(occurrence.status) || seen.has(occurrence.id)) continue;
    seen.add(occurrence.id);
    const approval = occurrence.kind === 'assignment' && actions.get(occurrence.id) === 'approve_assignment';
    if (occurrence.status === 'done' && !approval) continue;
    const due = Date.parse(occurrence.dueAt || occurrence.startAt || '');
    const overdue = occurrence.kind !== 'event' && Number.isFinite(due) && due < now.getTime();
    const important = ['urgent', 'high'].includes(item.priority) && due >= now.getTime() && due <= horizon;
    const person = members.find(member => member.id === (item.assignees[0] || item.participants[0] || item.owner || item.createdBy));
    const time = Number.isFinite(due) ? new Intl.DateTimeFormat('ru', { timeZone: timezone, day: 'numeric', month: 'short', ...(occurrence.allDay ? {} : { hour: '2-digit', minute: '2-digit' }) }).format(new Date(due)) : 'Без срока';
    const prefix = approval ? 'На подтверждение' : overdue ? 'Просрочено' : item.priority === 'urgent' ? 'Срочно' : 'Важно';
    const row: TodayAttentionItem = {
      id: `${approval ? 'attention-approval' : 'focus'}-${occurrence.id}`, itemId: item.id, occurrenceId: occurrence.id,
      body: `${prefix}: ${item.title} · ${time}${person ? ` · ${person.displayName}` : ''}`,
      memberInitial: person?.displayName.slice(0, 1) || 'С', memberName: person?.displayName || 'Семья',
      memberPortrait: person?.role === 'child' ? 'anya' : 'mom', color: (['green', 'lavender', 'blue', 'peach', 'yellow', 'danger', 'gray'].includes(person?.colorKey || '') ? person?.colorKey : 'green') as AccentColor,
      actionKind: approval ? 'approve_assignment' : 'open', actionLabel: approval ? 'Подтвердить' : 'Открыть запись', secondaryActionLabel: 'Вернуть'
    };
    if (approval || overdue || important) attention.push({ row, group: approval ? 0 : overdue ? 1 : 2,
      priority: { urgent: 0, high: 1, normal: 2, low: 3 }[item.priority] ?? 2, due: Number.isFinite(due) ? due : Infinity });
    else if (Number.isFinite(due) && dateKey(new Date(due)) === tomorrowKey) tomorrow.push({ row: { ...row, body: `${item.title} · ${time}${person ? ` · ${person.displayName}` : ''}` }, due });
  }
  attention.sort((a, b) => a.group - b.group || a.priority - b.priority || a.due - b.due || a.row.id.localeCompare(b.row.id));
  tomorrow.sort((a, b) => a.due - b.due || a.row.id.localeCompare(b.row.id));
  return { attention: attention.map(entry => entry.row), tomorrow: tomorrow.map(entry => entry.row) };
}

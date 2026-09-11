import type {
  ActivityRecord,
  FamilyMember,
  Item,
  ItemOccurrence,
  NotificationRecord,
  OccurrenceStatus
} from '$lib/types/domain';
import { CATEGORY_META } from '$lib/constants/categories';
import { canViewItem } from '$lib/utils/permissions';

export type AssignmentAction =
  | 'mark_assignment_done'
  | 'approve_assignment'
  | 'reject_assignment';

export type WorkStatusGroup = 'open' | 'review' | 'completed' | 'cancelled';

export type AssignmentCardModel = {
  id: string;
  itemId: string;
  group: WorkStatusGroup;
  assigneeIds: string[];
  memberTone: string;
  rejectionReason?: string;
  title: string;
  assigneeName: string;
  assigneeInitial: string;
  status: OccurrenceStatus;
  statusLabel: string;
  childStatusLabel: string;
  dueLabel: string;
  categoryLabel: string;
  tone: string;
  primaryAction?: AssignmentAction;
  primaryLabel?: string;
  secondaryAction?: AssignmentAction;
  secondaryLabel?: string;
};

export type ChildScheduleItem = {
  id: string;
  title: string;
  time: string;
};

export type ChildModeViewModel = {
  greeting: string;
  assignmentCards: AssignmentCardModel[];
  scheduleItems: ChildScheduleItem[];
};

export type NotificationInboxItem = {
  id: string;
  title: string;
  body: string;
  createdLabel: string;
  unread: boolean;
  actionLabel: string;
};

export type FeedViewItem = {
  id: string;
  actorName: string;
  summary: string;
  timeLabel: string;
  tone: string;
};

type AssignmentInput = {
  occurrences: ItemOccurrence[];
  items?: Item[];
  members: FamilyMember[];
  activeMemberId?: string;
  timezone?: string;
};

type ChildInput = AssignmentInput & {
  date?: Date;
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Назначено',
  accepted: 'Принято',
  in_progress: 'В работе',
  done: 'Ждёт проверки',
  approved: 'Готово',
  rejected: 'Нужно поправить',
  skipped: 'Пропущено',
  overdue: 'Нужна помощь',
  cancelled: 'Отменено',
  todo: 'Нужно сделать'
};

const CHILD_STATUS_LABELS: Record<string, string> = {
  assigned: 'Надо сделать',
  accepted: 'Надо сделать',
  in_progress: 'Надо сделать',
  done: 'Ждёт проверки',
  approved: 'Готово',
  rejected: 'Нужно поправить',
  overdue: 'Пора сделать',
  skipped: 'Пропущено',
  cancelled: 'Отменено',
  todo: 'Надо сделать'
};

export function createAssignmentViewModels(input: AssignmentInput): AssignmentCardModel[] {
  return input.occurrences
    .filter((occurrence) => occurrence.kind === 'assignment')
    .sort(compareAssignments)
    .map((occurrence) => mapAssignmentOccurrence(occurrence, input));
}

export function createTaskViewModels(input: AssignmentInput): AssignmentCardModel[] {
  return input.occurrences.filter((occurrence) => occurrence.kind === 'task')
    .sort(compareAssignments).map((occurrence) => mapAssignmentOccurrence(occurrence, input));
}

export function filterWorkCards(cards: AssignmentCardModel[], status: WorkStatusGroup | 'all', memberId = '', query = ''): AssignmentCardModel[] {
  const search = query.trim().toLocaleLowerCase('ru');
  return cards.filter((card) => (status === 'all' || card.group === status)
    && (!memberId || card.assigneeIds.includes(memberId))
    && (!search || card.title.toLocaleLowerCase('ru').includes(search)));
}

export function getChildModeAccess(members: FamilyMember[], userId?: string, familyId?: string, activeMemberId?: string): { adult?: FamilyMember; children: FamilyMember[]; selectedChild?: FamilyMember } {
  if (!userId || !familyId) return { children: [] };
  const available = members.filter((member) => member.active && member.family === familyId);
  const own = available.filter((member) => member.user === userId);
  const managers = own.filter((member) => ['owner', 'parent'].includes(member.role));
  const adult = own.find((member) => ['owner', 'parent', 'adult'].includes(member.role));
  const children = available.filter((member) => ['child', 'teen'].includes(member.role) && (
      member.user === userId || managers.some((manager) => manager.role === 'owner' || member.managedBy.includes(manager.id))
    ));
  return {
    adult, children,
    selectedChild: children.find((member) => member.id === activeMemberId) ?? (!adult ? children[0] : undefined)
  };
}

export function createChildModeViewModel(input: ChildInput): ChildModeViewModel {
  const activeMember = input.members.find((member) => member.id === input.activeMemberId);
  if (!activeMember?.active || !['child', 'teen'].includes(activeMember.role)) {
    return { greeting: 'Детский режим', assignmentCards: [], scheduleItems: [] };
  }
  const childOccurrences = input.occurrences.filter((occurrence) => {
    const item = input.items?.find((entry) => entry.id === occurrence.item);
    if (!item || occurrence.family !== activeMember.family || !canViewItem(activeMember, item, input.members)) return false;
    if (occurrence.kind === 'event') return item.visibility === 'family' || item.participants.includes(activeMember.id) || item.createdBy === activeMember.id;
    return occurrence.kind === 'task' ? item.owner === activeMember.id : item.assignees.includes(activeMember.id);
  });
  const dateKey = formatDateKey(input.date ?? new Date(), input.timezone);

  return {
    greeting: `Привет, ${activeMember?.displayName ?? 'семья'}`,
    assignmentCards: [...createAssignmentViewModels({
      ...input,
      occurrences: childOccurrences,
    }), ...createTaskViewModels({ ...input, occurrences: childOccurrences })].map((card) => ({
      ...card,
      statusLabel: card.childStatusLabel,
      primaryAction: card.primaryAction === 'mark_assignment_done'
        ? 'mark_assignment_done'
        : undefined,
      primaryLabel: card.primaryAction === 'mark_assignment_done'
        ? 'Я сделал'
        : undefined,
      secondaryAction: undefined,
      secondaryLabel: undefined
    })),
    scheduleItems: childOccurrences
      .filter((occurrence) => occurrence.kind === 'event' && occurrence.status !== 'cancelled' && getOccurrenceDateKey(occurrence, input.timezone) === dateKey)
      .sort((left, right) => Number(right.allDay) - Number(left.allDay) || getOccurrenceDateValue(left) - getOccurrenceDateValue(right))
      .map((occurrence) => ({
        id: occurrence.id,
        title: occurrence.titleSnapshot,
        time: getOccurrenceTime(occurrence, input.timezone)
      }))
  };
}

export function mapNotificationInboxItem(record: NotificationRecord): NotificationInboxItem {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    createdLabel: formatDateTimeLabel(record.created),
    unread: !record.readAt,
    actionLabel: record.occurrence ? 'Открыть поручение' : 'Открыть'
  };
}

export function mapActivityToFeedItem(
  record: ActivityRecord,
  members: FamilyMember[] = []
): FeedViewItem {
  const actor = members.find((member) => member.id === record.actor);

  return {
    id: record.id,
    actorName: actor?.displayName ?? 'Семья',
    summary: record.summary,
    timeLabel: formatDateTimeLabel(record.created),
    tone: getActivityTone(record.action)
  };
}

function mapAssignmentOccurrence(
  occurrence: ItemOccurrence,
  input: AssignmentInput
): AssignmentCardModel {
  const { members, activeMemberId } = input;
  const item = input.items?.find((entry) => entry.id === occurrence.item && entry.family === occurrence.family);
  const actor = members.find((member) => member.id === activeMemberId && member.active && member.family === occurrence.family);
  const assigneeIds = item ? item.kind === 'task' ? [item.owner || item.createdBy] : item.assignees : [];
  const assignees = members.filter((member) => assigneeIds.includes(member.id) && member.family === occurrence.family);
  const assigneeName = assignees.map((member) => member.displayName).join(', ') || 'Исполнитель недоступен';
  const managesAssignee = Boolean(actor && assignees.some((member) => actor.role === 'owner' || (actor.role === 'parent' && member.managedBy.includes(actor.id))));
  const hasAccess = Boolean(actor && item && canViewItem(actor, item, members));
  const waiting = occurrence.kind === 'assignment' && occurrence.status === 'done' && Boolean(item?.approvalRequired) && !occurrence.approvedAt;
  const reviewable = hasAccess && waiting && Boolean(actor && (item?.createdBy === actor.id || managesAssignee)) && !['child', 'teen'].includes(actor?.role ?? '');
  const canMarkDone = hasAccess && ['todo', 'assigned', 'accepted', 'in_progress', 'rejected', 'overdue'].includes(occurrence.status)
    && Boolean(actor && (occurrence.kind === 'task'
      ? item?.owner === actor.id || item?.createdBy === actor.id
      : assigneeIds.includes(actor.id) || managesAssignee));
  const group: WorkStatusGroup = waiting ? 'review' : ['done', 'approved'].includes(occurrence.status) ? 'completed' : ['cancelled', 'skipped'].includes(occurrence.status) ? 'cancelled' : 'open';
  const statusLabel = occurrence.status === 'done' ? waiting ? 'Ждёт проверки' : item ? 'Готово' : 'Выполнено' : STATUS_LABELS[occurrence.status] ?? occurrence.status;

  return {
    id: occurrence.id,
    itemId: occurrence.item,
    group,
    assigneeIds,
    memberTone: ['green', 'lavender', 'blue', 'peach', 'yellow'].includes(assignees[0]?.colorKey ?? '') ? assignees[0].colorKey! : 'green',
    rejectionReason: occurrence.status === 'rejected' ? occurrence.rejectionReason : undefined,
    title: occurrence.titleSnapshot,
    assigneeName,
    assigneeInitial: assignees.length ? getInitial(assignees[0].displayName) : '?',
    status: occurrence.status,
    statusLabel,
    childStatusLabel: occurrence.status === 'done' ? statusLabel : CHILD_STATUS_LABELS[occurrence.status] ?? occurrence.status,
    dueLabel: formatDateTimeLabel(occurrence.dueAt ?? occurrence.startAt, input.timezone),
    categoryLabel: CATEGORY_META[occurrence.categorySnapshot]?.label ?? 'Другое',
    tone: group === 'completed' ? 'green' : getStatusTone(occurrence.status),
    primaryAction: reviewable
      ? 'approve_assignment'
      : canMarkDone && activeMemberId
        ? 'mark_assignment_done'
        : undefined,
    primaryLabel: reviewable ? 'Подтвердить' : canMarkDone ? 'Выполнено' : undefined,
    secondaryAction: reviewable ? 'reject_assignment' : undefined,
    secondaryLabel: reviewable ? 'Вернуть' : undefined
  };
}

function compareAssignments(left: ItemOccurrence, right: ItemOccurrence): number {
  const statusOrder = (status: OccurrenceStatus) => {
    if (status === 'done') return 0;
    if (['assigned', 'accepted', 'in_progress', 'overdue', 'rejected'].includes(status)) return 1;
    return 2;
  };

  return (
    statusOrder(left.status) - statusOrder(right.status) ||
    getOccurrenceDateValue(left) - getOccurrenceDateValue(right) ||
    left.titleSnapshot.localeCompare(right.titleSnapshot)
  );
}

function getStatusTone(status: OccurrenceStatus): string {
  if (status === 'approved') return 'green';
  if (status === 'done') return 'yellow';
  if (status === 'rejected' || status === 'overdue') return 'peach';
  return 'blue';
}

function getActivityTone(action: ActivityRecord['action']): string {
  if (action === 'assignment.approved') return 'green';
  if (action === 'assignment.rejected') return 'peach';
  if (action === 'assignment.done') return 'yellow';
  return 'blue';
}

function getOccurrenceDateValue(occurrence: ItemOccurrence): number {
  const value = occurrence.dueAt ?? occurrence.startAt;
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function getOccurrenceDateKey(occurrence: ItemOccurrence, timezone?: string): string | undefined {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value) return undefined;
  return formatDateKey(new Date(value), timezone);
}

function getOccurrenceTime(occurrence: ItemOccurrence, timezone?: string): string {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value || occurrence.allDay) return 'Весь день';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Без времени';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(date);
}

function formatDateKey(date: Date, timezone?: string): string {
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(date);
}

function formatDateTimeLabel(value: string | undefined, timezone?: string): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Без срока';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  }).format(new Date(value));
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || 'С';
}

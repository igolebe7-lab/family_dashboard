import type {
  ActivityRecord,
  FamilyMember,
  ItemOccurrence,
  NotificationRecord,
  OccurrenceStatus
} from '$lib/types/domain';

export type AssignmentAction =
  | 'mark_assignment_done'
  | 'approve_assignment'
  | 'reject_assignment';

export type AssignmentCardModel = {
  id: string;
  itemId: string;
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
  members: FamilyMember[];
  activeMemberId?: string;
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

const CATEGORY_LABELS: Record<string, string> = {
  home: 'Дом',
  school: 'Школа',
  sport: 'Спорт',
  family: 'Семья',
  shopping: 'Покупки',
  health: 'Здоровье',
  work: 'Работа',
  money: 'Деньги',
  travel: 'Поездки',
  other: 'Другое'
};

export function createAssignmentViewModels(input: AssignmentInput): AssignmentCardModel[] {
  return input.occurrences
    .filter((occurrence) => occurrence.kind === 'assignment')
    .sort(compareAssignments)
    .map((occurrence) => mapAssignmentOccurrence(occurrence, input.members, input.activeMemberId));
}

export function createChildModeViewModel(input: ChildInput): ChildModeViewModel {
  const activeMember = input.members.find((member) => member.id === input.activeMemberId);
  const childOccurrences = input.occurrences.filter(
    (occurrence) =>
      !input.activeMemberId ||
      occurrence.visibleTo.includes(input.activeMemberId) ||
      occurrence.completedBy === input.activeMemberId
  );
  const dateKey = formatDateKey(input.date ?? new Date());

  return {
    greeting: `Привет, ${activeMember?.displayName ?? 'семья'}`,
    assignmentCards: createAssignmentViewModels({
      occurrences: childOccurrences,
      members: input.members,
      activeMemberId: input.activeMemberId
    }).map((card) => ({
      ...card,
      statusLabel: card.childStatusLabel,
      primaryAction: ['assigned', 'accepted', 'in_progress', 'rejected', 'overdue'].includes(card.status)
        ? 'mark_assignment_done'
        : undefined,
      primaryLabel: ['assigned', 'accepted', 'in_progress', 'rejected', 'overdue'].includes(card.status)
        ? 'Я сделал'
        : undefined,
      secondaryAction: undefined,
      secondaryLabel: undefined
    })),
    scheduleItems: childOccurrences
      .filter((occurrence) => occurrence.kind === 'event' && getOccurrenceDateKey(occurrence) === dateKey)
      .map((occurrence) => ({
        id: occurrence.id,
        title: occurrence.titleSnapshot,
        time: getOccurrenceTime(occurrence)
      }))
      .sort((left, right) => left.time.localeCompare(right.time))
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
  members: FamilyMember[],
  activeMemberId?: string
): AssignmentCardModel {
  const assignee = getOccurrenceMember(occurrence, members);
  const reviewable = occurrence.status === 'done' && !occurrence.approvedAt;
  const canMarkDone = ['assigned', 'accepted', 'in_progress', 'rejected', 'overdue'].includes(occurrence.status);

  return {
    id: occurrence.id,
    itemId: occurrence.item,
    title: occurrence.titleSnapshot,
    assigneeName: assignee.displayName,
    assigneeInitial: getInitial(assignee.displayName),
    status: occurrence.status,
    statusLabel: STATUS_LABELS[occurrence.status] ?? occurrence.status,
    childStatusLabel: CHILD_STATUS_LABELS[occurrence.status] ?? occurrence.status,
    dueLabel: formatDateTimeLabel(occurrence.dueAt ?? occurrence.startAt),
    categoryLabel: CATEGORY_LABELS[occurrence.categorySnapshot] ?? 'Другое',
    tone: getStatusTone(occurrence.status),
    primaryAction: reviewable
      ? 'approve_assignment'
      : canMarkDone && activeMemberId
        ? 'mark_assignment_done'
        : undefined,
    primaryLabel: reviewable ? 'Подтвердить' : canMarkDone && activeMemberId ? 'Я сделал' : undefined,
    secondaryAction: reviewable ? 'reject_assignment' : undefined,
    secondaryLabel: reviewable ? 'Вернуть' : undefined
  };
}

function getOccurrenceMember(occurrence: ItemOccurrence, members: FamilyMember[]): FamilyMember {
  const memberIds = [
    occurrence.completedBy,
    ...occurrence.visibleTo.filter((memberId) => memberId !== occurrence.completedBy)
  ].filter((memberId): memberId is string => Boolean(memberId));

  return (
    memberIds.map((memberId) => members.find((member) => member.id === memberId)).find(Boolean) ??
    members[0] ?? {
      id: 'family',
      family: occurrence.family,
      displayName: 'Семья',
      role: 'guest',
      managedBy: [],
      active: true
    }
  );
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

function getOccurrenceDateKey(occurrence: ItemOccurrence): string | undefined {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value) return undefined;
  return formatDateKey(new Date(value));
}

function getOccurrenceTime(occurrence: ItemOccurrence): string {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value || occurrence.allDay) return 'Весь день';

  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function formatDateTimeLabel(value: string | undefined): string {
  if (!value) return 'Без срока';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || 'С';
}

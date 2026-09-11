import { getCategoryMeta } from '$lib/constants/categories';
import type { AccentColor } from '$lib/constants/colors';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { listOccurrencesInRange } from '$lib/api/occurrences.api';
import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';
import { getWeekRange, getMonthRange, toIsoRange } from '$lib/utils/date';
import type { TodayNavigationView } from '$lib/calendar/today-navigation';
import type { IconName } from '$lib/design/icon-registry';
import { createAssignmentViewModels, type AssignmentCardModel } from '$lib/assignments/assignments-view';
import {
  createTodayViewModel,
  formatDateKey,
  type TodayAttentionItem,
  type TodayAllDayItem,
  type TodayFamilyMember,
  type TodayTimelineItem,
  type TodayViewModel,
  type TodayWeekEvent
} from './today-view-model';

type ListOccurrencesInRange = typeof listOccurrencesInRange;

export type TodayOccurrenceDataInput = {
  date?: Date;
  view?: TodayNavigationView;
  activeMemberId?: string;
  occurrences: ItemOccurrence[];
  members?: FamilyMember[];
};

export type LoadTodayViewModelOptions = {
  date?: Date;
  view?: TodayNavigationView;
  members?: FamilyMember[];
  listOccurrencesInRange?: ListOccurrencesInRange;
};

type MemberDisplay = {
  color: AccentColor;
  initial: string;
  name: string;
  portrait: TodayFamilyMember['portrait'];
};

const DEFAULT_MEMBER: MemberDisplay = {
  color: 'yellow',
  initial: 'С',
  name: 'Вся семья',
  portrait: 'misha'
};

const PORTRAITS_BY_COLOR: Record<string, TodayFamilyMember['portrait']> = {
  lavender: 'mom',
  blue: 'dad',
  green: 'misha',
  peach: 'anya',
  yellow: 'misha'
};

export function createTodayViewModelFromOccurrences(input: TodayOccurrenceDataInput): TodayViewModel {
  const date = input.date ?? new Date();
  const base = createTodayViewModel(date);
  const memberById = new Map((input.members ?? []).map((member) => [member.id, member]));
  const assignmentActions = new Map(createAssignmentViewModels({
    occurrences: input.occurrences,
    items: input.occurrences.flatMap((occurrence) => occurrence.itemRecord ? [occurrence.itemRecord] : []),
    members: input.members ?? [], activeMemberId: input.activeMemberId
  }).map((card) => [card.id, card]));
  const range = getTodayOccurrenceRange(date, input.view);
  const todayKey = formatDateKey(date);
  const weekOccurrences = input.occurrences.filter((occurrence) => {
    const value = occurrence.startAt ?? occurrence.dueAt;
    const time = value ? new Date(value).getTime() : NaN;
    return time >= new Date(range.from).getTime() && time <= new Date(range.to).getTime();
  });

  const weekEvents = weekOccurrences
    .map((occurrence) => mapOccurrenceToWeekEvent(occurrence, memberById))
    .sort(compareWeekEvents);
  const todayOccurrences = weekOccurrences.filter((occurrence) => getOccurrenceDateKey(occurrence) === todayKey);
  const allDayItems = todayOccurrences
    .filter((occurrence) => occurrence.allDay)
    .map((occurrence) => mapOccurrenceToAllDayItem(occurrence, memberById, input.members?.length ?? 0))
    .sort((left, right) => left.title.localeCompare(right.title));
  const timelineItems = todayOccurrences
    .filter((occurrence) => !occurrence.allDay)
    .map((occurrence) => ({ ...mapOccurrenceToTimelineItem(occurrence, memberById, input.members?.length ?? 0),
      ...getTimelineAction(assignmentActions.get(occurrence.id)) }))
    .sort((left, right) => left.time.localeCompare(right.time));
  const attentionItems = createAttentionItems(weekOccurrences, memberById, date, assignmentActions);
  const familyMembers =
    input.members && input.members.length > 0 ? input.members.map(mapFamilyMemberToTodayMember) : base.familyMembers;

  return {
    ...base,
    familyMembers,
    allDayItems,
    weekEvents,
    timelineItems,
    attentionItems,
    attentionCount: attentionItems.length,
    emptyState: {
      ...base.emptyState,
      isEmpty: timelineItems.length === 0 && allDayItems.length === 0
    }
  };
}

function createAttentionItems(
  occurrences: ItemOccurrence[],
  memberById: Map<string, FamilyMember>,
  date: Date,
  assignmentActions: Map<string, AssignmentCardModel>
): TodayAttentionItem[] {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatDateKey(tomorrow);

  return occurrences
    .flatMap((occurrence) => {
      if (assignmentActions.get(occurrence.id)?.primaryAction === 'approve_assignment') {
        return [mapWaitingApprovalAttention(occurrence, memberById)];
      }

      if (isOverdueAssignment(occurrence, date)) {
        return [mapOverdueAttention(occurrence, memberById)];
      }

      if (isTomorrowPrepReminder(occurrence, tomorrowKey)) {
        return [mapPrepReminderAttention(occurrence, memberById)];
      }

      return [];
    })
    .sort(compareAttentionItems);
}

function isOverdueAssignment(occurrence: ItemOccurrence, date: Date): boolean {
  if (occurrence.kind !== 'assignment') return false;
  if (!['assigned', 'accepted', 'in_progress', 'overdue'].includes(occurrence.status)) return false;

  const dueValue = occurrence.dueAt ?? occurrence.startAt;
  if (!dueValue) return false;

  return new Date(dueValue).getTime() < date.getTime();
}

function isTomorrowPrepReminder(occurrence: ItemOccurrence, tomorrowKey: string): boolean {
  return occurrence.kind === 'event' && getOccurrenceDateKey(occurrence) === tomorrowKey;
}

function mapWaitingApprovalAttention(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>
): TodayAttentionItem {
  const member = getOccurrenceMember(
    {
      ...occurrence,
      itemRecord: occurrence.completedBy && occurrence.itemRecord && memberById.get(occurrence.completedBy)?.family === occurrence.family
        ? { ...occurrence.itemRecord, assignees: [occurrence.completedBy] }
        : occurrence.itemRecord
    },
    memberById
  );

  return {
    id: `attention-approval-${occurrence.id}`,
    itemId: occurrence.item,
    occurrenceId: occurrence.id,
    body: `${member.name} отметил «${occurrence.titleSnapshot}» как готово`,
    ...memberToAttentionMember(member),
    actionKind: 'approve_assignment',
    actionLabel: 'Подтвердить',
    secondaryActionLabel: 'Вернуть'
  };
}

function mapOverdueAttention(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>
): TodayAttentionItem {
  const member = getOccurrenceMember(occurrence, memberById);

  return {
    id: `attention-overdue-${occurrence.id}`,
    itemId: occurrence.item,
    body: `Просрочено: ${member.name} — «${occurrence.titleSnapshot}»`,
    ...memberToAttentionMember(member),
    actionKind: 'open',
    actionLabel: 'Открыть'
  };
}

function mapPrepReminderAttention(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>
): TodayAttentionItem {
  const member = getOccurrenceMember(occurrence, memberById);

  return {
    id: `attention-prep-${occurrence.id}`,
    itemId: occurrence.item,
    body: `Завтра: «${occurrence.titleSnapshot}» — ${member.name}`,
    ...memberToAttentionMember(member),
    actionKind: 'open',
    actionLabel: 'Открыть событие'
  };
}

function memberToAttentionMember(
  member: MemberDisplay
): Pick<TodayAttentionItem, 'color' | 'memberInitial' | 'memberName' | 'memberPortrait'> {
  return {
    color: member.color,
    memberInitial: member.initial,
    memberName: member.name,
    memberPortrait: member.portrait
  };
}

function compareAttentionItems(left: TodayAttentionItem, right: TodayAttentionItem): number {
  const priority = (item: TodayAttentionItem) => {
    if (item.id.startsWith('attention-approval-')) return 0;
    if (item.id.startsWith('attention-overdue-')) return 1;
    return 2;
  };

  return priority(left) - priority(right) || left.id.localeCompare(right.id);
}

export async function loadTodayViewModelFromOccurrences(
  context: ActiveFamilyContext,
  options: LoadTodayViewModelOptions = {}
): Promise<TodayViewModel> {
  const date = options.date ?? new Date();
  const range = getTodayOccurrenceRange(date, options.view);
  const loader = options.listOccurrencesInRange ?? listOccurrencesInRange;
  const result = await loader(context, range);

  return createTodayViewModelFromOccurrences({
    date,
    view: options.view,
    activeMemberId: context.memberId,
    occurrences: result.items,
    members: options.members
  });
}

export function getTodayOccurrenceRange(date: Date, view: TodayNavigationView = 'week') {
  // The month grid includes the leading/trailing days of its boundary weeks.
  const month = getMonthRange(date);
  const range = toIsoRange(view === 'month'
    ? { start: getWeekRange(month.start).start, end: getWeekRange(month.end).end }
    : getWeekRange(date));
  return { from: range.start, to: range.end };
}

function mapOccurrenceToWeekEvent(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>
): TodayWeekEvent {
  const member = getOccurrenceMember(occurrence, memberById, memberById.size);
  const category = getCategoryMeta(occurrence.categorySnapshot);

  return {
    id: occurrence.id,
    itemId: occurrence.item,
    category: occurrence.categorySnapshot,
    day: getOccurrenceDateKey(occurrence) ?? '',
    start: getOccurrenceTime(occurrence),
    durationMinutes: getOccurrenceDurationMinutes(occurrence),
    title: occurrence.titleSnapshot,
    memberName: member.name,
    memberInitial: member.initial,
    memberPortrait: member.portrait,
    color: category.color,
    icon: category.icon as IconName
  };
}

function mapOccurrenceToTimelineItem(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>,
  familyMemberCount: number
): TodayTimelineItem {
  const member = getOccurrenceMember(occurrence, memberById, familyMemberCount);
  const category = getCategoryMeta(occurrence.categorySnapshot);

  return {
    id: occurrence.id,
    itemId: occurrence.item,
    kind: occurrence.kind,
    time: getOccurrenceTime(occurrence),
    dateLabel: formatOccurrenceDateLabel(occurrence),
    title: occurrence.titleSnapshot,
    subtitle: member.name,
    memberName: member.name,
    memberInitial: member.initial,
    memberPortrait: member.portrait,
    color: category.color,
    category: occurrence.categorySnapshot,
    categoryLabel: category.label,
    icon: category.icon as IconName
  };
}

function mapOccurrenceToAllDayItem(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>,
  familyMemberCount: number
): TodayAllDayItem {
  const member = getOccurrenceMember(occurrence, memberById, familyMemberCount);
  const category = getCategoryMeta(occurrence.categorySnapshot);

  return {
    id: occurrence.id,
    itemId: occurrence.item,
    kind: occurrence.kind,
    label: 'Весь день',
    dateLabel: formatOccurrenceDateLabel(occurrence),
    title: occurrence.titleSnapshot,
    subtitle: member.name,
    memberName: member.name,
    memberInitial: member.initial,
    memberPortrait: member.portrait,
    color: category.color,
    category: occurrence.categorySnapshot,
    categoryLabel: category.label,
    icon: category.icon as IconName
  };
}

function getTimelineAction(
  card: AssignmentCardModel | undefined
): Pick<TodayTimelineItem, 'actionKind' | 'actionLabel'> {
  if (
    card?.primaryAction === 'mark_assignment_done'
  ) {
    return {
      actionKind: 'mark_assignment_done',
      actionLabel: 'Я сделал'
    };
  }

  return {};
}

function mapFamilyMemberToTodayMember(member: FamilyMember, index: number): TodayFamilyMember {
  const color = getMemberColor(member, index);

  return {
    id: member.id,
    name: member.displayName,
    roleLabel: member.role,
    color,
    initial: getInitial(member.displayName),
    portrait: PORTRAITS_BY_COLOR[color] ?? DEFAULT_MEMBER.portrait,
    todayCount: 0
  };
}

function getOccurrenceMember(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>,
  familyMemberCount = memberById.size
): MemberDisplay {
  const memberIds = getPreferredOccurrenceMemberIds(occurrence);
  if (occurrence.kind === 'event' && familyMemberCount > 0 && memberById.size > 0 && [...memberById.keys()].every((id) => memberIds.includes(id))) {
    return DEFAULT_MEMBER;
  }

  const members = memberIds.map((id) => memberById.get(id)).filter((member): member is FamilyMember => Boolean(member));
  const member = members[0];

  if (!member) return { ...DEFAULT_MEMBER, name: 'Участник не указан', initial: '?' };

  const color = getMemberColor(member, 0);

  return {
    color,
    initial: getInitial(member.displayName),
    name: members.map((member) => member.displayName).join(', '),
    portrait: PORTRAITS_BY_COLOR[color] ?? DEFAULT_MEMBER.portrait
  };
}

function getPreferredOccurrenceMemberIds(occurrence: ItemOccurrence): string[] {
  const item = occurrence.itemRecord;
  if (!item || item.id !== occurrence.item || item.family !== occurrence.family) return [];
  if (item.kind === 'event') return item.participants;
  if (item.kind === 'assignment') return item.assignees;
  return item.owner ? [item.owner] : [item.createdBy];
}

function getMemberColor(member: FamilyMember, index: number): AccentColor {
  if (isAccentColor(member.colorKey)) return member.colorKey;
  return (['lavender', 'blue', 'green', 'peach'][index % 4] ?? 'green') as AccentColor;
}

function isAccentColor(value: unknown): value is AccentColor {
  return (
    value === 'green' ||
    value === 'lavender' ||
    value === 'blue' ||
    value === 'peach' ||
    value === 'yellow' ||
    value === 'danger' ||
    value === 'gray'
  );
}

function getOccurrenceDateKey(occurrence: ItemOccurrence): string | undefined {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value) return undefined;
  return formatDateKey(new Date(value));
}

function getOccurrenceTime(occurrence: ItemOccurrence): string {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value || occurrence.allDay) return '00:00';

  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatOccurrenceDateLabel(occurrence: ItemOccurrence): string {
  const value = occurrence.startAt ?? occurrence.dueAt;
  if (!value) return 'Без даты';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function getOccurrenceDurationMinutes(occurrence: ItemOccurrence): number {
  if (!occurrence.startAt || !occurrence.endAt) return 60;

  const start = new Date(occurrence.startAt).getTime();
  const end = new Date(occurrence.endAt).getTime();
  const duration = Math.round((end - start) / 60000);
  return duration > 0 ? duration : 60;
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || DEFAULT_MEMBER.initial;
}

function toGenitiveName(value: string): string {
  const name = value.trim();
  if (!name) return DEFAULT_MEMBER.name;
  if (name.endsWith('а')) {
    const stem = name.slice(0, -1);
    return `${stem}${/[жчшщ]$/i.test(stem) ? 'и' : 'ы'}`;
  }
  if (name.endsWith('я')) return `${name.slice(0, -1)}и`;
  return name;
}

function compareWeekEvents(left: TodayWeekEvent, right: TodayWeekEvent): number {
  return `${left.day} ${left.start}`.localeCompare(`${right.day} ${right.start}`);
}

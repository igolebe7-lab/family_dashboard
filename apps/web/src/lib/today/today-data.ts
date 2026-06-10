import { getCategoryMeta } from '$lib/constants/categories';
import type { AccentColor } from '$lib/constants/colors';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { listOccurrencesInRange } from '$lib/api/occurrences.api';
import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';
import { getWeekRange, toIsoRange } from '$lib/utils/date';
import type { IconName } from '$lib/design/icon-registry';
import {
  createTodayViewModel,
  formatDateKey,
  type TodayFamilyMember,
  type TodayTimelineItem,
  type TodayViewModel,
  type TodayWeekEvent
} from './today-view-model';

type ListOccurrencesInRange = typeof listOccurrencesInRange;

export type TodayOccurrenceDataInput = {
  date?: Date;
  occurrences: ItemOccurrence[];
  members?: FamilyMember[];
};

export type LoadTodayViewModelOptions = {
  date?: Date;
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
  const weekDayKeys = new Set(base.weekDays.map((day) => day.dateKey));
  const todayKey = formatDateKey(date);
  const weekOccurrences = input.occurrences.filter((occurrence) => {
    const dateKey = getOccurrenceDateKey(occurrence);
    return dateKey ? weekDayKeys.has(dateKey) : false;
  });

  const weekEvents = weekOccurrences
    .map((occurrence) => mapOccurrenceToWeekEvent(occurrence, memberById))
    .sort(compareWeekEvents);
  const timelineItems = weekOccurrences
    .filter((occurrence) => getOccurrenceDateKey(occurrence) === todayKey)
    .map((occurrence) => mapOccurrenceToTimelineItem(occurrence, memberById))
    .sort((left, right) => left.time.localeCompare(right.time));
  const familyMembers =
    input.members && input.members.length > 0 ? input.members.map(mapFamilyMemberToTodayMember) : base.familyMembers;

  return {
    ...base,
    familyMembers,
    weekEvents,
    timelineItems,
    emptyState: {
      ...base.emptyState,
      isEmpty: timelineItems.length === 0
    }
  };
}

export async function loadTodayViewModelFromOccurrences(
  context: ActiveFamilyContext,
  options: LoadTodayViewModelOptions = {}
): Promise<TodayViewModel> {
  const date = options.date ?? new Date();
  const range = toIsoRange(getWeekRange(date));
  const loader = options.listOccurrencesInRange ?? listOccurrencesInRange;
  const result = await loader(context, {
    from: range.start,
    to: range.end
  });

  return createTodayViewModelFromOccurrences({
    date,
    occurrences: result.items,
    members: options.members
  });
}

function mapOccurrenceToWeekEvent(
  occurrence: ItemOccurrence,
  memberById: Map<string, FamilyMember>
): TodayWeekEvent {
  const member = getOccurrenceMember(occurrence, memberById);
  const category = getCategoryMeta(occurrence.categorySnapshot);

  return {
    id: occurrence.id,
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
  memberById: Map<string, FamilyMember>
): TodayTimelineItem {
  const member = getOccurrenceMember(occurrence, memberById);
  const category = getCategoryMeta(occurrence.categorySnapshot);

  return {
    id: occurrence.id,
    time: getOccurrenceTime(occurrence),
    title: occurrence.titleSnapshot,
    subtitle: member.name,
    memberName: member.name,
    memberInitial: member.initial,
    memberPortrait: member.portrait,
    color: category.color,
    category: occurrence.categorySnapshot,
    icon: category.icon as IconName
  };
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
  memberById: Map<string, FamilyMember>
): MemberDisplay {
  const member = occurrence.visibleTo.map((memberId) => memberById.get(memberId)).find(Boolean);

  if (!member) return DEFAULT_MEMBER;

  const color = getMemberColor(member, 0);

  return {
    color,
    initial: getInitial(member.displayName),
    name: member.displayName,
    portrait: PORTRAITS_BY_COLOR[color] ?? DEFAULT_MEMBER.portrait
  };
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

function compareWeekEvents(left: TodayWeekEvent, right: TodayWeekEvent): number {
  return `${left.day} ${left.start}`.localeCompare(`${right.day} ${right.start}`);
}

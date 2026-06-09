import type { ItemCategory } from '$lib/constants/categories';
import type { AccentColor } from '$lib/constants/colors';
import type { IconName } from '$lib/design/icon-registry';

export type TodayFamilyMember = {
  id: string;
  name: string;
  roleLabel: string;
  color: AccentColor;
  initial: string;
  portrait: 'mom' | 'dad' | 'misha' | 'anya';
  todayCount: number;
};

export type TodayTimelineItem = {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  memberName: string;
  memberInitial: string;
  memberPortrait: TodayFamilyMember['portrait'];
  color: AccentColor;
  category: ItemCategory;
  icon: IconName;
};

export type TodayAttentionItem = {
  id: string;
  body: string;
  memberInitial: string;
  memberName: string;
  memberPortrait: TodayFamilyMember['portrait'];
  color: AccentColor;
  actionLabel: string;
};

export type TodayQuickAction = {
  id: 'task' | 'assignment' | 'event';
  label: string;
  icon: IconName;
  color: AccentColor;
};

export type TodayFeedItem = {
  id: string;
  actor: string;
  body: string;
  timeLabel: string;
  icon: IconName;
  color: AccentColor;
};

export type TodayWeekDay = {
  id: string;
  dateKey: string;
  weekday: string;
  day: string;
  month: string;
  isToday: boolean;
};

export type TodayWeekEvent = {
  id: string;
  day: string;
  start: string;
  durationMinutes: number;
  title: string;
  memberName: string;
  memberInitial: string;
  memberPortrait: TodayFamilyMember['portrait'];
  color: AccentColor;
  icon: IconName;
};

export type TodayViewModelOptions = {
  date?: Date;
  fixture?: 'desktop-reference';
};

type ResolvedTodayViewModelOptions = {
  date: Date;
  fixture?: 'desktop-reference';
};

type WeekEventInput = {
  day: string;
  start: string;
  durationMinutes: number;
  title: string;
  member: string;
  tone: AccentColor;
  icon: IconName;
};

export type TodayViewModel = {
  greeting: string;
  dateLabel: string;
  weekLabel: string;
  weekDays: TodayWeekDay[];
  weekTimes: string[];
  weekEvents: TodayWeekEvent[];
  familyMembers: TodayFamilyMember[];
  timelineItems: TodayTimelineItem[];
  attentionItems: TodayAttentionItem[];
  attentionCount: number;
  quickActions: TodayQuickAction[];
  feedItems: TodayFeedItem[];
  emptyState: {
    isEmpty: boolean;
    title: string;
    body: string;
  };
};

const GENITIVE_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
];

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const FAMILY_MEMBERS: TodayFamilyMember[] = [
  {
    id: 'mom',
    name: 'Мама',
    roleLabel: 'родитель',
    color: 'lavender',
    initial: 'М',
    portrait: 'mom',
    todayCount: 2
  },
  {
    id: 'dad',
    name: 'Папа',
    roleLabel: 'родитель',
    color: 'blue',
    initial: 'П',
    portrait: 'dad',
    todayCount: 1
  },
  {
    id: 'misha',
    name: 'Миша',
    roleLabel: 'ребёнок',
    color: 'green',
    initial: 'М',
    portrait: 'misha',
    todayCount: 3
  },
  {
    id: 'anya',
    name: 'Аня',
    roleLabel: 'ребёнок',
    color: 'peach',
    initial: 'А',
    portrait: 'anya',
    todayCount: 2
  }
];

export const REFERENCE_DESKTOP_WEEK_FIXTURE = {
  weekStart: '2024-05-20',
  selectedDate: '2024-05-24',
  events: [
    {
      day: '2024-05-20',
      start: '08:00',
      durationMinutes: 60,
      title: 'Школа',
      member: 'Миша',
      tone: 'green',
      icon: 'backpack'
    },
    {
      day: '2024-05-20',
      start: '10:30',
      durationMinutes: 60,
      title: 'Врач',
      member: 'Мама',
      tone: 'lavender',
      icon: 'stethoscope'
    },
    {
      day: '2024-05-20',
      start: '18:00',
      durationMinutes: 60,
      title: 'Тренировка',
      member: 'Аня',
      tone: 'peach',
      icon: 'dumbbell'
    },
    {
      day: '2024-05-21',
      start: '18:00',
      durationMinutes: 60,
      title: 'Работа',
      member: 'Папа',
      tone: 'blue',
      icon: 'briefcase-business'
    },
    {
      day: '2024-05-22',
      start: '14:00',
      durationMinutes: 60,
      title: 'Кружок рисования',
      member: 'Мама',
      tone: 'lavender',
      icon: 'palette'
    },
    {
      day: '2024-05-22',
      start: '20:00',
      durationMinutes: 60,
      title: 'Кино с семьёй',
      member: 'Вся семья',
      tone: 'yellow',
      icon: 'users-round'
    },
    {
      day: '2024-05-23',
      start: '08:00',
      durationMinutes: 60,
      title: 'Школа',
      member: 'Миша',
      tone: 'green',
      icon: 'backpack'
    },
    {
      day: '2024-05-23',
      start: '16:00',
      durationMinutes: 60,
      title: 'Встреча с клиентом',
      member: 'Папа',
      tone: 'blue',
      icon: 'briefcase-business'
    },
    {
      day: '2024-05-24',
      start: '10:30',
      durationMinutes: 60,
      title: 'Врач',
      member: 'Мама',
      tone: 'lavender',
      icon: 'stethoscope'
    },
    {
      day: '2024-05-24',
      start: '18:00',
      durationMinutes: 60,
      title: 'Тренировка',
      member: 'Аня',
      tone: 'peach',
      icon: 'dumbbell'
    },
    {
      day: '2024-05-24',
      start: '20:00',
      durationMinutes: 60,
      title: 'Семейный ужин',
      member: 'Вся семья',
      tone: 'yellow',
      icon: 'users-round'
    },
    {
      day: '2024-05-25',
      start: '12:00',
      durationMinutes: 60,
      title: 'Поездка в парк',
      member: 'Вся семья',
      tone: 'yellow',
      icon: 'trees'
    },
    {
      day: '2024-05-26',
      start: '11:00',
      durationMinutes: 60,
      title: 'Футбол',
      member: 'Миша',
      tone: 'green',
      icon: 'dumbbell'
    }
  ]
} as const satisfies {
  weekStart: string;
  selectedDate: string;
  events: ReadonlyArray<{
    day: string;
    start: string;
    durationMinutes: number;
    title: string;
    member: string;
    tone: AccentColor;
    icon: IconName;
  }>;
};

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${GENITIVE_MONTHS[date.getMonth()]}`;
}

function formatTodayLabel(date: Date): string {
  const datePart = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
  const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(date);

  return `Сегодня, ${datePart}, ${weekday}`;
}

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function formatWeekLabel(weekDays: TodayWeekDay[]): string {
  const firstDay = weekDays[0];
  const lastDay = weekDays[weekDays.length - 1];

  if (!firstDay || !lastDay) return '';

  const start = createDateFromKey(firstDay.dateKey);
  const end = createDateFromKey(lastDay.dateKey);
  const currentYear = new Date().getFullYear();
  const endYear = end.getFullYear();
  const yearSuffix = endYear === currentYear ? '' : ` ${endYear}`;

  if (start.getFullYear() !== endYear) {
    return `${formatDayMonth(start)} ${start.getFullYear()} — ${formatDayMonth(end)} ${endYear}`;
  }

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} — ${end.getDate()} ${GENITIVE_MONTHS[end.getMonth()]}${yearSuffix}`;
  }

  return `${formatDayMonth(start)} — ${formatDayMonth(end)}${yearSuffix}`;
}

function createWeekDays(date: Date): TodayWeekDay[] {
  const weekStart = getWeekStart(date);
  const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  const todayKey = formatDateKey(date);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const dateKey = formatDateKey(day);

    return {
      id: dateKey,
      dateKey,
      weekday: weekdayFormatter.format(day).replace('.', ''),
      day: String(day.getDate()),
      month: GENITIVE_MONTHS[day.getMonth()],
      isToday: dateKey === todayKey
    };
  });
}

function getEventMember(memberName: string): Pick<TodayWeekEvent, 'memberInitial' | 'memberPortrait'> {
  const member = FAMILY_MEMBERS.find((item) => item.name === memberName);

  if (member) {
    return {
      memberInitial: member.initial,
      memberPortrait: member.portrait
    };
  }

  return {
    memberInitial: 'С',
    memberPortrait: 'misha'
  };
}

function createWeekEvent(event: WeekEventInput, index: number): TodayWeekEvent {
  const member = getEventMember(event.member);

  return {
    id: `week-event-${index}-${event.day}-${event.start}`,
    day: event.day,
    start: event.start,
    durationMinutes: event.durationMinutes,
    title: event.title,
    memberName: event.member,
    memberInitial: member.memberInitial,
    memberPortrait: member.memberPortrait,
    color: event.tone,
    icon: event.icon
  };
}

function createReferenceWeekEvents(): TodayWeekEvent[] {
  return REFERENCE_DESKTOP_WEEK_FIXTURE.events.map((event, index) => createWeekEvent(event, index));
}

function createDemoWeekEvents(weekDays: TodayWeekDay[]): TodayWeekEvent[] {
  const referenceStart = createDateFromKey(REFERENCE_DESKTOP_WEEK_FIXTURE.weekStart);

  return REFERENCE_DESKTOP_WEEK_FIXTURE.events.map((event, index) => {
    const referenceDate = createDateFromKey(event.day);
    const dayOffset = Math.round((referenceDate.getTime() - referenceStart.getTime()) / MS_IN_DAY);
    const targetDay = weekDays[dayOffset]?.dateKey ?? weekDays[0]?.dateKey ?? event.day;
    return createWeekEvent({ ...event, day: targetDay }, index);
  });
}

function resolveViewModelOptions(input?: Date | TodayViewModelOptions): ResolvedTodayViewModelOptions {
  if (input instanceof Date) {
    return { date: input, fixture: undefined };
  }

  return {
    date: input?.date ?? new Date(),
    fixture: input?.fixture
  };
}

export function createTodayViewModel(input?: Date | TodayViewModelOptions): TodayViewModel {
  const options = resolveViewModelOptions(input);
  const date =
    options.fixture === 'desktop-reference'
      ? createDateFromKey(REFERENCE_DESKTOP_WEEK_FIXTURE.selectedDate)
      : options.date;
  const weekDays = createWeekDays(date);
  const weekTimes = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  const weekEvents =
    options.fixture === 'desktop-reference' ? createReferenceWeekEvents() : createDemoWeekEvents(weekDays);
  const timelineItems: TodayTimelineItem[] = [
    {
      id: 'school',
      time: '08:00',
      title: 'Школа',
      subtitle: 'Миша',
      memberName: 'Миша',
      memberInitial: 'М',
      memberPortrait: 'misha',
      color: 'green',
      category: 'school',
      icon: 'backpack'
    },
    {
      id: 'doctor',
      time: '10:30',
      title: 'Врач',
      subtitle: 'мама',
      memberName: 'Мама',
      memberInitial: 'М',
      memberPortrait: 'mom',
      color: 'lavender',
      category: 'health',
      icon: 'stethoscope'
    },
    {
      id: 'sport',
      time: '18:00',
      title: 'Тренировка',
      subtitle: 'Аня',
      memberName: 'Аня',
      memberInitial: 'А',
      memberPortrait: 'anya',
      color: 'peach',
      category: 'sport',
      icon: 'dumbbell'
    },
    {
      id: 'dinner',
      time: '20:00',
      title: 'Семейный ужин',
      subtitle: 'Вся семья',
      memberName: 'Вся семья',
      memberInitial: 'С',
      memberPortrait: 'misha',
      color: 'yellow',
      category: 'family',
      icon: 'users-round'
    }
  ];

  const attentionItems: TodayAttentionItem[] = [
    {
      id: 'trash-approval',
      body: 'Миша отметил «Вынести мусор» как готово',
      memberInitial: 'М',
      memberName: 'Миша',
      memberPortrait: 'misha',
      color: 'green',
      actionLabel: 'Проверить'
    },
    {
      id: 'sport-prep',
      body: 'Завтра у Ани тренировка — подготовить форму',
      memberInitial: 'А',
      memberName: 'Аня',
      memberPortrait: 'anya',
      color: 'peach',
      actionLabel: 'Добавить дело'
    }
  ];

  const feedItems: TodayFeedItem[] = [
    {
      id: 'feed-trash-done',
      actor: 'Миша',
      body: 'завершил дело «Вынести мусор»',
      timeLabel: '08:15',
      icon: 'square-check-big',
      color: 'green'
    },
    {
      id: 'feed-training-added',
      actor: 'Аня',
      body: 'добавила событие «Тренировка»',
      timeLabel: 'Вчера',
      icon: 'dumbbell',
      color: 'peach'
    },
    {
      id: 'feed-doctor-added',
      actor: 'Мама',
      body: 'добавила событие «Врач»',
      timeLabel: 'Вчера',
      icon: 'stethoscope',
      color: 'lavender'
    }
  ];

  return {
    greeting: 'Доброе утро, семья',
    dateLabel: formatTodayLabel(date),
    weekLabel: formatWeekLabel(weekDays),
    weekDays,
    weekTimes,
    weekEvents,
    familyMembers: FAMILY_MEMBERS,
    timelineItems,
    attentionItems,
    attentionCount: attentionItems.length,
    quickActions: [
      { id: 'task', label: '+ Дело', icon: 'square-check-big', color: 'green' },
      { id: 'assignment', label: '+ Поручение', icon: 'message-square-text', color: 'lavender' },
      { id: 'event', label: '+ Событие', icon: 'calendar-days', color: 'peach' }
    ],
    feedItems,
    emptyState: {
      isEmpty: timelineItems.length === 0,
      title: 'Сегодня спокойно',
      body: 'Когда появятся события или дела, они будут здесь.'
    }
  };
}

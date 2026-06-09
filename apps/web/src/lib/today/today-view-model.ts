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

export type TodayWeekDay = {
  id: string;
  weekday: string;
  day: string;
  month: string;
  isToday: boolean;
};

export type TodayWeekEvent = {
  id: string;
  dayIndex: number;
  row: number;
  span: number;
  time: string;
  title: string;
  memberName: string;
  memberInitial: string;
  memberPortrait: TodayFamilyMember['portrait'];
  color: AccentColor;
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
  emptyState: {
    isEmpty: boolean;
    title: string;
    body: string;
  };
};

function formatTodayLabel(date: Date): string {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return `Сегодня, ${formatter.format(date)}`;
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

  return `${firstDay.day} — ${lastDay.day} ${lastDay.month}`;
}

function createWeekDays(date: Date): TodayWeekDay[] {
  const weekStart = getWeekStart(date);
  const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
  const todayKey = date.toDateString();

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);

    return {
      id: day.toISOString(),
      weekday: weekdayFormatter.format(day).replace('.', ''),
      day: String(day.getDate()),
      month: monthFormatter.format(day),
      isToday: day.toDateString() === todayKey
    };
  });
}

export function createTodayViewModel(date = new Date()): TodayViewModel {
  const weekDays = createWeekDays(date);
  const weekTimes = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
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

  return {
    greeting: 'Доброе утро, семья',
    dateLabel: formatTodayLabel(date),
    weekLabel: formatWeekLabel(weekDays),
    weekDays,
    weekTimes,
    weekEvents: [
      {
        id: 'week-school-mon',
        dayIndex: 0,
        row: 1,
        span: 1,
        time: '08:00',
        title: 'Школа',
        memberName: 'Миша',
        memberInitial: 'М',
        memberPortrait: 'misha',
        color: 'green',
        icon: 'backpack'
      },
      {
        id: 'week-doctor-mon',
        dayIndex: 0,
        row: 2,
        span: 1,
        time: '10:30',
        title: 'Врач',
        memberName: 'мама',
        memberInitial: 'М',
        memberPortrait: 'mom',
        color: 'lavender',
        icon: 'stethoscope'
      },
      {
        id: 'week-art-wed',
        dayIndex: 2,
        row: 4,
        span: 1,
        time: '14:00',
        title: 'Кружок рисования',
        memberName: 'мама',
        memberInitial: 'М',
        memberPortrait: 'mom',
        color: 'lavender',
        icon: 'sparkles'
      },
      {
        id: 'week-school-thu',
        dayIndex: 3,
        row: 1,
        span: 1,
        time: '08:00',
        title: 'Школа',
        memberName: 'Миша',
        memberInitial: 'М',
        memberPortrait: 'misha',
        color: 'green',
        icon: 'backpack'
      },
      {
        id: 'week-meeting-thu',
        dayIndex: 3,
        row: 5,
        span: 1,
        time: '16:00',
        title: 'Встреча',
        memberName: 'Папа',
        memberInitial: 'П',
        memberPortrait: 'dad',
        color: 'blue',
        icon: 'briefcase-business'
      },
      {
        id: 'week-doctor-fri',
        dayIndex: 4,
        row: 2,
        span: 1,
        time: '10:30',
        title: 'Врач',
        memberName: 'мама',
        memberInitial: 'М',
        memberPortrait: 'mom',
        color: 'lavender',
        icon: 'stethoscope'
      },
      {
        id: 'week-sport-fri',
        dayIndex: 4,
        row: 6,
        span: 1,
        time: '18:00',
        title: 'Тренировка',
        memberName: 'Аня',
        memberInitial: 'А',
        memberPortrait: 'anya',
        color: 'peach',
        icon: 'dumbbell'
      },
      {
        id: 'week-dinner-fri',
        dayIndex: 4,
        row: 7,
        span: 1,
        time: '20:00',
        title: 'Семейный ужин',
        memberName: 'Вся семья',
        memberInitial: 'С',
        memberPortrait: 'misha',
        color: 'yellow',
        icon: 'users-round'
      },
      {
        id: 'week-park-sat',
        dayIndex: 5,
        row: 3,
        span: 1,
        time: '12:00',
        title: 'Поездка в парк',
        memberName: 'Вся семья',
        memberInitial: 'С',
        memberPortrait: 'anya',
        color: 'yellow',
        icon: 'users-round'
      },
      {
        id: 'week-football-sun',
        dayIndex: 6,
        row: 2,
        span: 1,
        time: '11:00',
        title: 'Футбол',
        memberName: 'Миша',
        memberInitial: 'М',
        memberPortrait: 'misha',
        color: 'green',
        icon: 'dumbbell'
      }
    ],
    familyMembers: [
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
    ],
    timelineItems,
    attentionItems,
    attentionCount: attentionItems.length,
    quickActions: [
      { id: 'task', label: '+ Дело', icon: 'square-check-big', color: 'green' },
      { id: 'assignment', label: '+ Поручение', icon: 'message-square-text', color: 'lavender' },
      { id: 'event', label: '+ Событие', icon: 'calendar-days', color: 'peach' }
    ],
    emptyState: {
      isEmpty: timelineItems.length === 0,
      title: 'Сегодня спокойно',
      body: 'Когда появятся события или дела, они будут здесь.'
    }
  };
}

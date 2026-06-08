import type { ItemCategory } from '$lib/constants/categories';
import type { AccentColor } from '$lib/constants/colors';
import type { IconName } from '$lib/design/icon-registry';

export type TodayFamilyMember = {
  id: string;
  name: string;
  roleLabel: string;
  color: AccentColor;
  initial: string;
  todayCount: number;
};

export type TodayTimelineItem = {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  memberName: string;
  memberInitial: string;
  color: AccentColor;
  category: ItemCategory;
  icon: IconName;
};

export type TodayAttentionItem = {
  id: string;
  title: string;
  body: string;
  memberInitial: string;
  color: AccentColor;
  actionLabel: string;
};

export type TodayQuickAction = {
  id: 'task' | 'assignment' | 'event';
  label: string;
  icon: IconName;
  color: AccentColor;
};

export type TodayViewModel = {
  greeting: string;
  dateLabel: string;
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

export function createTodayViewModel(): TodayViewModel {
  const timelineItems: TodayTimelineItem[] = [
    {
      id: 'school',
      time: '08:00',
      title: 'Школа',
      subtitle: 'Рюкзак и форма готовы',
      memberName: 'Миша',
      memberInitial: 'М',
      color: 'green',
      category: 'school',
      icon: 'backpack'
    },
    {
      id: 'doctor',
      time: '10:30',
      title: 'Врач',
      subtitle: 'Поликлиника на Лесной',
      memberName: 'Мама',
      memberInitial: 'М',
      color: 'lavender',
      category: 'health',
      icon: 'stethoscope'
    },
    {
      id: 'pickup',
      time: '16:00',
      title: 'Забрать заказ',
      subtitle: 'Пункт выдачи до 20:00',
      memberName: 'Папа',
      memberInitial: 'П',
      color: 'blue',
      category: 'shopping',
      icon: 'shopping-bag'
    },
    {
      id: 'sport',
      time: '18:00',
      title: 'Тренировка',
      subtitle: 'Не забыть бутылку воды',
      memberName: 'Аня',
      memberInitial: 'А',
      color: 'peach',
      category: 'sport',
      icon: 'dumbbell'
    }
  ];

  const attentionItems: TodayAttentionItem[] = [
    {
      id: 'trash-approval',
      title: 'Ждёт подтверждения',
      body: 'Миша отметил «Вынести мусор» как готово',
      memberInitial: 'М',
      color: 'green',
      actionLabel: 'Проверить'
    },
    {
      id: 'sport-prep',
      title: 'Подготовить заранее',
      body: 'Завтра у Ани тренировка, нужна чистая форма',
      memberInitial: 'А',
      color: 'peach',
      actionLabel: 'Добавить дело'
    }
  ];

  return {
    greeting: 'Доброе утро',
    dateLabel: 'Сегодня, понедельник',
    familyMembers: [
      { id: 'mom', name: 'Мама', roleLabel: 'родитель', color: 'lavender', initial: 'М', todayCount: 2 },
      { id: 'dad', name: 'Папа', roleLabel: 'родитель', color: 'blue', initial: 'П', todayCount: 1 },
      { id: 'misha', name: 'Миша', roleLabel: 'ребёнок', color: 'green', initial: 'М', todayCount: 3 },
      { id: 'anya', name: 'Аня', roleLabel: 'ребёнок', color: 'peach', initial: 'А', todayCount: 2 }
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

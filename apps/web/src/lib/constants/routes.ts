export type AppRoute = {
  label: string;
  href: string;
  icon: string;
  description: string;
};

export const APP_ROUTE_DEFINITIONS = {
  today: {
    label: 'Сегодня',
    href: '/app/today',
    icon: 'calendar-days',
    description: 'Главный семейный экран дня'
  },
  calendar: {
    label: 'Календарь',
    href: '/app/calendar',
    icon: 'calendar',
    description: 'День, неделя и месяц'
  },
  assignments: {
    label: 'Поручения',
    href: '/app/assignments',
    icon: 'square-check-big',
    description: 'Домашние поручения и подтверждения'
  },
  tasks: {
    label: 'Дела',
    href: '/app/tasks',
    icon: 'list-checks',
    description: 'Семейные дела без подтверждения'
  },
  family: {
    label: 'Семья',
    href: '/app/family',
    icon: 'users-round',
    description: 'Профили и настройки семьи'
  },
  feed: {
    label: 'Лента',
    href: '/app/feed',
    icon: 'message-square-text',
    description: 'Семейная лента изменений'
  }
} as const satisfies Record<string, AppRoute>;

export const PRIMARY_APP_ROUTE = APP_ROUTE_DEFINITIONS.today.href;

export const primaryNavigation = [
  APP_ROUTE_DEFINITIONS.today,
  APP_ROUTE_DEFINITIONS.calendar,
  APP_ROUTE_DEFINITIONS.assignments,
  APP_ROUTE_DEFINITIONS.family
] as const;

export const desktopNavigation = [
  APP_ROUTE_DEFINITIONS.today,
  APP_ROUTE_DEFINITIONS.calendar,
  APP_ROUTE_DEFINITIONS.assignments,
  APP_ROUTE_DEFINITIONS.tasks,
  APP_ROUTE_DEFINITIONS.feed,
  APP_ROUTE_DEFINITIONS.family
] as const;

export const ROUTE_GROUPS = {
  primaryNavigation,
  desktopNavigation
} as const;

export const APP_ROUTES_MODEL = {
  primaryNavigation,
  desktopNavigation
} as const;

export const APP_ROUTES = {
  ...APP_ROUTE_DEFINITIONS,
  primaryNavigation,
  desktopNavigation
} as const;

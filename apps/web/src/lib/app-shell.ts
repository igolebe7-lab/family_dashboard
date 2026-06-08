export type ShellStatus = 'online-shell' | 'offline-shell';

export type ShellNavigationItem = {
  label: string;
  route: string;
  description: string;
};

export type ShellViewModel = {
  status: ShellStatus;
  title: string;
  greeting: string;
  message: string;
  primaryRoute: string;
  navigation: ShellNavigationItem[];
};

export type ShellOptions = {
  apiAvailable: boolean;
};

const PRIMARY_ROUTE = '/app/today';

const NAVIGATION: ShellNavigationItem[] = [
  {
    label: 'Сегодня',
    route: '/app/today',
    description: 'Главный семейный экран дня'
  },
  {
    label: 'Календарь',
    route: '/app/calendar',
    description: 'День, неделя и месяц'
  },
  {
    label: 'Поручения',
    route: '/app/assignments',
    description: 'Домашние поручения и подтверждения'
  },
  {
    label: 'Семья',
    route: '/app/family',
    description: 'Профили и настройки семьи'
  }
];

export function createShellViewModel(options: ShellOptions): ShellViewModel {
  return {
    status: options.apiAvailable ? 'online-shell' : 'offline-shell',
    title: 'Семейный Пульс',
    greeting: 'Доброе утро, семья',
    message: options.apiAvailable
      ? 'Семейные данные подключены.'
      : 'Каркас приложения готов. Данные семьи появятся после подключения PocketBase.',
    primaryRoute: PRIMARY_ROUTE,
    navigation: NAVIGATION
  };
}

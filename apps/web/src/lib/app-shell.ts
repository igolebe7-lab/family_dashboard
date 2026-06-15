import { primaryNavigation, PRIMARY_APP_ROUTE } from './constants/routes';

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

export function createShellViewModel(options: ShellOptions): ShellViewModel {
  return {
    status: options.apiAvailable ? 'online-shell' : 'offline-shell',
    title: 'Семейный Пульс',
    greeting: 'Доброе утро, семья',
    message: options.apiAvailable
      ? 'Семейные данные подключены.'
      : 'Каркас приложения готов. Данные семьи появятся после подключения PocketBase.',
    primaryRoute: PRIMARY_APP_ROUTE,
    navigation: primaryNavigation.map((item) => ({
      label: item.label,
      route: item.href,
      description: item.description
    }))
  };
}

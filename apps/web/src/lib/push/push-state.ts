export type PushEnvironment = {
  secure: boolean; serviceWorker: boolean; pushManager: boolean; notification: boolean;
  ios: boolean; standalone: boolean;
};

export function pushAvailability(env: PushEnvironment): 'ready' | 'install' | 'insecure' | 'unsupported' {
  if (!env.secure) return 'insecure';
  if (env.ios && !env.standalone) return 'install';
  return env.serviceWorker && env.pushManager && env.notification ? 'ready' : 'unsupported';
}

export function safePushPath(value: unknown): string {
  if (typeof value === 'string' && /^\/app\/today\?date=\d{4}-\d{2}-\d{2}&view=day$/.test(value)) {
    const date = value.slice('/app/today?date='.length, '/app/today?date='.length + 10);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) return value;
  }
  return typeof value === 'string' && /^\/app\/items\/[a-zA-Z0-9]{15}$/.test(value)
    ? value : '/app/notifications';
}

export function pushErrorMessage(cause: unknown): string {
  const error = cause instanceof Error ? cause : new Error('');
  if (error.name === 'NotAllowedError' || /permission denied/i.test(error.message)) {
    return 'Браузер не разрешил регистрацию уведомлений. Откройте приложение в обычном окне, не инкогнито, и разрешите уведомления для этого сайта в настройках браузера.';
  }
  if (error.name === 'AbortError' || error.name === 'TimeoutError' || /failed|network/i.test(error.message)) {
    return 'Не удалось подключиться к службе уведомлений браузера. Проверьте подключение и повторите. Если ошибка сохраняется, проверьте ограничения сети и браузера.';
  }
  return error.message || 'Не удалось изменить настройки уведомлений.';
}

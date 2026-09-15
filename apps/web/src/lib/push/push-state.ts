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
  return typeof value === 'string' && /^\/app\/items\/[a-zA-Z0-9]{15}$/.test(value)
    ? value : '/app/notifications';
}

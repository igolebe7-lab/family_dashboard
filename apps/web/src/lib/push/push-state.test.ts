import { describe, expect, it } from 'vitest';
import { pushAvailability, safePushPath } from './push-state';

describe('push availability', () => {
  const supported = { secure: true, serviceWorker: true, pushManager: true, notification: true, ios: false, standalone: false };
  it('requires Home Screen on iPhone even if PushManager is absent in Safari', () => {
    expect(pushAvailability({ ...supported, ios: true, pushManager: false })).toBe('install');
    expect(pushAvailability({ ...supported, ios: true, standalone: true })).toBe('ready');
  });
  it('requires secure transport and supported APIs', () => {
    expect(pushAvailability({ ...supported, secure: false })).toBe('insecure');
    expect(pushAvailability({ ...supported, pushManager: false })).toBe('unsupported');
    expect(pushAvailability(supported)).toBe('ready');
  });
  it('allows only local item or inbox links', () => {
    expect(safePushPath('/app/items/abcdefghijklmno')).toBe('/app/items/abcdefghijklmno');
    for (const path of ['https://evil.test', '//evil.test', '/_/','/login', '/app/items/a?redirect=x']) {
      expect(safePushPath(path)).toBe('/app/notifications');
    }
  });
});

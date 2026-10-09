import { afterEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { sessionStore } from './session.store';
import { displayTimezone } from './timezone.store';
import { displayClock } from './clock.store';
import { getGreeting } from '$lib/utils/timezone';

afterEach(() => { sessionStore.clear(); vi.useRealTimers(); });
it('keeps each account preference and resets on logout', () => {
  expect(get(displayTimezone)).toBe('Europe/Moscow');
  const user = { id: 'a', email: 'a@example.test', name: 'A', verified: false };
  sessionStore.setSession({ token: 'a', user: { ...user, timezone: 'America/New_York' } });
  expect(get(displayTimezone)).toBe('America/New_York');
  sessionStore.setSession({ token: 'b', user: { ...user, id: 'b', timezone: 'Asia/Tokyo' } });
  expect(get(displayTimezone)).toBe('Asia/Tokyo');
  sessionStore.clear(); expect(get(displayTimezone)).toBe('Europe/Moscow');
});
it('refreshes the greeting at the local boundary and cleans up its timer', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T08:59:59Z'));
  let greeting = '';
  const stop = displayClock.subscribe(now => { greeting = getGreeting(now, 'Europe/Moscow'); });
  expect(greeting).toBe('Доброе утро, семья');
  vi.advanceTimersByTime(1010); expect(greeting).toBe('Добрый день, семья');
  stop(); expect(vi.getTimerCount()).toBe(0);
});

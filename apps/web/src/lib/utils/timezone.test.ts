import { describe, expect, it } from 'vitest';
import { calendarDateInZone, calendarDayStartIso, dateKeyInZone, getGreeting, resolveTimezone } from './timezone';

describe('personal timezone', () => {
  it('uses the first existing minute when DST skips local midnight', () => {
    expect(calendarDayStartIso('2026-09-06', 'America/Santiago')).toBe('2026-09-06T04:00:00.000Z');
    expect(calendarDayStartIso('2026-10-09', 'Europe/Moscow')).toBe('2026-10-08T21:00:00.000Z');
  });
  it('defaults to Moscow and changes dates across UTC midnight', () => {
    expect(resolveTimezone()).toBe('Europe/Moscow');
    expect(resolveTimezone('bad/zone')).toBe('Europe/Moscow');
    const instant = new Date('2026-10-08T22:30:00Z');
    expect(dateKeyInZone(instant, 'Europe/Moscow')).toBe('2026-10-09');
    expect(dateKeyInZone(instant, 'America/New_York')).toBe('2026-10-08');
    expect(calendarDateInZone(instant, 'Europe/Moscow').getDate()).toBe(9);
  });
  it('greets by actual local time, including exact boundaries', () => {
    for (const [hour, greeting] of [[0,'Доброй ночи'],[5,'Доброй ночи'],[6,'Доброе утро'],[11,'Доброе утро'],[12,'Добрый день'],[17,'Добрый день'],[18,'Добрый вечер'],[22,'Добрый вечер'],[23,'Доброй ночи']] as const) {
      expect(getGreeting(new Date(`2026-10-09T${String(hour).padStart(2,'0')}:00:00Z`), 'UTC')).toBe(`${greeting}, семья`);
    }
    expect(getGreeting(new Date('2026-10-09T09:00:00Z'), 'Europe/Moscow')).toBe('Добрый день, семья');
  });
});

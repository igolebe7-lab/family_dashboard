import { createDateTimeIso } from '$lib/composer/composer-form';
import { getDateTimeFormatter } from './date-format';

export const DEFAULT_TIMEZONE = 'Europe/Moscow';

export function resolveTimezone(value?: string): string {
  if (!value) return DEFAULT_TIMEZONE;
  try { getDateTimeFormatter('ru', { timeZone: value }); return value; }
  catch { return DEFAULT_TIMEZONE; }
}

export function dateKeyInZone(date: Date, timezone: string): string {
  const parts = getDateTimeFormatter('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

// Civil dates are navigation coordinates, not instants to convert again.
export function calendarDateInZone(now: Date, timezone: string): Date {
  const [year, month, day] = dateKeyInZone(now, timezone).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function calendarDayStartIso(dateKey: string, timezone: string): string {
  try { return createDateTimeIso(dateKey, '00:00', timezone); }
  catch (error) {
    // Some IANA zones advance at midnight. Range boundaries use the first
    // existing minute; explicit user-entered times remain strictly validated.
    for (let hour = 1; hour < 24; hour++) {
      let start: string;
      try { start = createDateTimeIso(dateKey, `${String(hour).padStart(2, '0')}:00`, timezone); }
      catch { continue; }
      for (let minute = (hour - 1) * 60 + 1; minute < hour * 60; minute++) {
        try { return createDateTimeIso(dateKey, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, timezone); }
        catch { /* Skip the nonexistent minutes in the transition gap. */ }
      }
      return start;
    }
    throw error;
  }
}

export function getGreeting(now: Date, timezone: string): string {
  const hour = Number(getDateTimeFormatter('en', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  return `${hour < 6 || hour >= 23 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'}, семья`;
}

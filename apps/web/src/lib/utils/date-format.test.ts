import { describe, expect, it } from 'vitest';
import { getDateTimeFormatter } from './date-format';

describe('bounded date formatter reuse', () => {
  it('reuses equivalent options without mixing timezones or formats', () => {
    const first = getDateTimeFormatter('en', { timeZone: 'Europe/Moscow', hour: '2-digit', hourCycle: 'h23' });
    expect(getDateTimeFormatter('en', { hourCycle: 'h23', hour: '2-digit', timeZone: 'Europe/Moscow' })).toBe(first);
    const instant = new Date('2026-10-09T12:00:00Z');
    expect(first.format(instant)).toBe('15');
    expect(getDateTimeFormatter('en', { timeZone: 'UTC', hour: '2-digit', hourCycle: 'h23' }).format(instant)).toBe('12');
  });
  it('evicts old formatters and does not cache invalid timezones', () => {
    const first = getDateTimeFormatter('en', { timeZone: 'UTC' });
    for (let i = 0; i < 65; i++) getDateTimeFormatter(`en-x-${i}`, { timeZone: 'UTC' });
    expect(getDateTimeFormatter('en', { timeZone: 'UTC' })).not.toBe(first);
    expect(() => getDateTimeFormatter('en', { timeZone: 'not/a-zone' })).toThrow();
    expect(getDateTimeFormatter('en', { timeZone: 'UTC' }).format(new Date(0))).toBeTruthy();
  });
});

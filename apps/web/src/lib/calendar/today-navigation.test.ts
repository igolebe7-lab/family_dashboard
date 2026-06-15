import { describe, expect, it } from 'vitest';

import {
  buildTodayCalendarHref,
  parseTodayCalendarSearch,
  parseTodayDateKey
} from './today-navigation';

describe('today calendar navigation', () => {
  it('builds a Today URL focused on a selected calendar day', () => {
    expect(buildTodayCalendarHref({ dateKey: '2026-06-18' })).toBe('/app/today?date=2026-06-18&view=day');
    expect(buildTodayCalendarHref({ dateKey: '2026-06-18', view: 'week' })).toBe(
      '/app/today?date=2026-06-18&view=week'
    );
  });

  it('parses Today search params into a safe date and supported view', () => {
    const state = parseTodayCalendarSearch(new URLSearchParams('date=2026-06-18&view=month'));

    expect(state).toEqual({
      date: parseTodayDateKey('2026-06-18'),
      dateKey: '2026-06-18',
      view: 'month'
    });
  });

  it('ignores invalid dates and unsupported views', () => {
    expect(parseTodayCalendarSearch(new URLSearchParams('date=2026-02-31&view=week'))).toBeNull();
    expect(parseTodayCalendarSearch(new URLSearchParams('date=2026-06-18&view=year'))).toEqual({
      date: parseTodayDateKey('2026-06-18'),
      dateKey: '2026-06-18',
      view: 'day'
    });
  });
});

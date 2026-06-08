import { describe, expect, it } from 'vitest';

import { getDayRange, getMonthRange, getWeekRange } from './date';

describe('date range helpers', () => {
  it('returns an inclusive local day range', () => {
    const range = getDayRange(new Date(2026, 4, 15, 13, 20));

    expect(range.start).toEqual(new Date(2026, 4, 15, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 4, 15, 23, 59, 59, 999));
  });

  it('uses Monday as the first day of a calendar week', () => {
    const range = getWeekRange(new Date(2026, 4, 15));

    expect(range.start).toEqual(new Date(2026, 4, 11, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 4, 17, 23, 59, 59, 999));
  });

  it('returns a full month range', () => {
    const range = getMonthRange(new Date(2026, 1, 12));

    expect(range.start).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
  });
});

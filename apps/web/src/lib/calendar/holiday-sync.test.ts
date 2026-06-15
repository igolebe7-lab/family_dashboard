import { describe, expect, it, vi } from 'vitest';

import {
  HOLIDAY_CACHE_TTL_MS,
  createHolidayCacheKey,
  loadPublicHolidaysForYear,
  loadPublicHolidaysForYears,
  mapNagerHolidayToDayAnnotation
} from './holiday-sync';

const holiday = {
  date: '2026-01-01',
  localName: 'Новый год',
  name: "New Year's Day",
  countryCode: 'RU',
  fixed: false,
  global: true,
  counties: null,
  launchYear: null,
  types: ['Public']
};

describe('holiday sync', () => {
  it('normalizes Nager.Date public holidays into read-only day annotations', () => {
    expect(mapNagerHolidayToDayAnnotation(holiday, 'family_1')).toEqual(
      expect.objectContaining({
        family: 'family_1',
        kind: 'public_holiday',
        title: 'Новый год',
        month: 1,
        day: 1,
        year: 2026,
        recurrence: 'one_time',
        color: 'gray',
        tone: 'system',
        visibility: 'family',
        source: 'nager_date',
        readonly: true,
        countryCode: 'RU',
        sourceUid: 'nager_date:RU:2026-01-01'
      })
    );
  });

  it('uses a weekly cache before calling the public holiday provider', async () => {
    const storage = new Map<string, string>();
    const now = new Date('2026-06-10T10:00:00.000Z');
    const fetcher = vi.fn();
    storage.set(
      createHolidayCacheKey(2026, 'RU'),
      JSON.stringify({
        fetchedAt: now.getTime() - HOLIDAY_CACHE_TTL_MS + 1000,
        holidays: [holiday]
      })
    );

    const result = await loadPublicHolidaysForYear({
      countryCode: 'RU',
      familyId: 'family_1',
      fetcher,
      now: () => now,
      storage,
      year: 2026
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.map((item) => item.title)).toEqual(['Новый год']);
  });

  it('loads and deduplicates multiple years for the calendar layer', async () => {
    const storage = new Map<string, string>();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      return {
        ok: true,
        json: async () => [
          {
            ...holiday,
            date: url.includes('/2027/') ? '2027-01-01' : '2026-01-01'
          }
        ]
      } as Response;
    });

    const result = await loadPublicHolidaysForYears({
      countryCode: 'ru',
      familyId: 'family_1',
      fetcher,
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      storage,
      years: [2026, 2027, 2027]
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.sourceUid)).toEqual([
      'nager_date:RU:2026-01-01',
      'nager_date:RU:2027-01-01'
    ]);
  });
});

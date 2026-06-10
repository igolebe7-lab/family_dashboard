import { describe, expect, it } from 'vitest';

import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  HOUR_HEIGHT,
  createCalendarTimeLabels,
  getCalendarBodyHeight,
  getCalendarEventHeight,
  getCalendarEventTop,
  getCalendarHourTop,
  getCalendarInitialScrollTop
} from './week-calendar';

describe('week calendar coordinates', () => {
  it('maps a full 24-hour day to stable pixel offsets', () => {
    expect(CALENDAR_START_HOUR).toBe(0);
    expect(CALENDAR_END_HOUR).toBe(24);
    expect(HOUR_HEIGHT).toBe(76);

    expect(getCalendarBodyHeight()).toBe(1824);
    expect(getCalendarEventTop('00:00')).toBe(0);
    expect(getCalendarEventTop('08:00')).toBe(608);
    expect(getCalendarEventTop('10:30')).toBe(798);
    expect(getCalendarEventTop('20:00')).toBe(1520);
    expect(getCalendarEventTop('24:00')).toBe(1824);
  });

  it('keeps hour labels and event cards in the same coordinate system', () => {
    expect(getCalendarHourTop(0)).toBe(getCalendarEventTop('00:00'));
    expect(getCalendarHourTop(10)).toBe(getCalendarEventTop('10:00'));
    expect(getCalendarHourTop(24)).toBe(getCalendarEventTop('24:00'));
  });

  it('creates labels for the whole day in two-hour steps', () => {
    expect(createCalendarTimeLabels()).toEqual([
      '00:00',
      '02:00',
      '04:00',
      '06:00',
      '08:00',
      '10:00',
      '12:00',
      '14:00',
      '16:00',
      '18:00',
      '20:00',
      '22:00',
      '24:00'
    ]);
  });

  it('starts the scroll position at the earliest visible event', () => {
    expect(
      getCalendarInitialScrollTop([
        { start: '18:00' },
        { start: '08:00' },
        { start: '10:30' }
      ])
    ).toBe(getCalendarEventTop('08:00'));

    expect(getCalendarInitialScrollTop([])).toBe(0);
  });

  it('uses a readable minimum height for short events', () => {
    expect(getCalendarEventHeight(20)).toBe(56);
    expect(getCalendarEventHeight(60)).toBe(76);
    expect(getCalendarEventHeight(90)).toBe(114);
  });
});

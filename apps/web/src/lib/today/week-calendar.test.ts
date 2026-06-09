import { describe, expect, it } from 'vitest';

import {
  CALENDAR_START_HOUR,
  HOUR_HEIGHT,
  getCalendarEventHeight,
  getCalendarEventTop,
  getCalendarHourTop
} from './week-calendar';

describe('week calendar coordinates', () => {
  it('maps clock time to a stable pixel offset from the start hour', () => {
    expect(CALENDAR_START_HOUR).toBe(8);
    expect(HOUR_HEIGHT).toBe(76);

    expect(getCalendarEventTop('08:00')).toBe(0);
    expect(getCalendarEventTop('08:30')).toBe(38);
    expect(getCalendarEventTop('10:00')).toBe(152);
    expect(getCalendarEventTop('10:30')).toBe(190);
    expect(getCalendarEventTop('12:00')).toBe(304);
    expect(getCalendarEventTop('16:00')).toBe(608);
    expect(getCalendarEventTop('18:00')).toBe(760);
    expect(getCalendarEventTop('20:00')).toBe(912);
  });

  it('keeps hour labels and event cards in the same coordinate system', () => {
    expect(getCalendarHourTop(10)).toBe(getCalendarEventTop('10:00'));
    expect(getCalendarHourTop(16)).toBe(getCalendarEventTop('16:00'));
  });

  it('uses a readable minimum height for short events', () => {
    expect(getCalendarEventHeight(20)).toBe(56);
    expect(getCalendarEventHeight(60)).toBe(76);
    expect(getCalendarEventHeight(90)).toBe(114);
  });
});

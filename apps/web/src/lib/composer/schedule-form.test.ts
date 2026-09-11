import { describe, expect, it } from 'vitest';
import { createScheduleFormValues, createScheduleInput } from './schedule-form';

describe('single event schedule form', () => {
  it('round-trips the displayed event timezone rather than the browser zone', () => {
    const occurrence = { startAt: '2026-06-11T07:00:00.000Z', endAt: '2026-06-11T08:00:00.000Z', allDay: false };
    const values = createScheduleFormValues(occurrence, 'Asia/Tokyo');
    expect(values).toEqual({ startDate: '2026-06-11', endDate: '2026-06-11', startTime: '16:00', endTime: '17:00', allDay: false });
    expect(createScheduleInput(values, 'Asia/Tokyo')).toEqual({ ok: true, input: { startAt: occurrence.startAt, endAt: occurrence.endAt } });
  });

  it('moves one occurrence across dates and never submits a series rule or status', () => {
    expect(createScheduleInput({ startDate: '2026-10-24', startTime: '23:30', endDate: '2026-10-25', endTime: '04:00', allDay: false }, 'Europe/Amsterdam'))
      .toEqual({ ok: true, input: { startAt: '2026-10-24T21:30:00.000Z', endAt: '2026-10-25T03:00:00.000Z' } });
  });

  it('rejects reverse intervals, invalid dates and DST gaps', () => {
    const values = { startDate: '2026-03-29', startTime: '01:00', endDate: '2026-03-29', endTime: '04:00', allDay: false };
    expect(createScheduleInput({ ...values, startTime: '02:30' }, 'Europe/Amsterdam').ok).toBe(false);
    expect(createScheduleInput({ ...values, endTime: '00:30' }, 'Europe/Amsterdam').ok).toBe(false);
    expect(createScheduleInput({ ...values, startDate: '2026-02-30' }, 'Europe/Amsterdam').ok).toBe(false);
  });

  it('keeps all-day moves at local day boundaries', () => {
    expect(createScheduleInput({ startDate: '2026-03-29', startTime: '', endDate: '2026-03-29', endTime: '', allDay: true }, 'Europe/Amsterdam'))
      .toEqual({ ok: true, input: { startAt: '2026-03-28T23:00:00.000Z', endAt: '2026-03-29T21:59:00.000Z' } });
  });

  it('rejects zero duration to match the schedule endpoint', () => {
    expect(createScheduleInput({ startDate: '2026-09-14', startTime: '09:00', endDate: '2026-09-14', endTime: '09:00', allDay: false }, 'Europe/Amsterdam'))
      .toEqual({ ok: false, error: 'Окончание должно быть позже начала' });
  });
});

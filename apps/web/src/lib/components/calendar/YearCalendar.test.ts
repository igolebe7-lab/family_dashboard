import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import YearCalendar from './YearCalendar.svelte';
import { createYearCalendarViewModel } from '$lib/calendar/year-calendar';

describe('YearCalendar current date', () => {
  it('marks today once in its own month, independently of selection', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12));
    try {
      const { body } = render(YearCalendar, { props: {
        model: createYearCalendarViewModel(2026, []), selectedDateKey: '2026-09-02'
      } });
      expect(body.match(/aria-current="date"/g)).toHaveLength(1);
      expect(body).toContain('year-day--today');
      expect(body).toContain('tabindex="0"');
      const other = render(YearCalendar, { props: { model: createYearCalendarViewModel(2025, []) } });
      expect(other.body).not.toContain('aria-current="date"');
    } finally { vi.useRealTimers(); }
  });
});

import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import TodayMonthGrid from './TodayMonthGrid.svelte';
import { createTodayMonthViewModel } from '$lib/today/today-month-calendar';
import type { TodayWeekEvent } from '$lib/today/today-view-model';

it('renders per-record member dots, overflow and actual today independently of selection', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T22:30Z'));
  try {
    const events: TodayWeekEvent[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i), day: '2026-10-09', start: '12:00', durationMinutes: 60, title: 'Дело',
      memberName: 'Ева', memberInitial: 'Е', memberPortrait: 'anya', color: 'green',
      memberColors: i % 2 ? ['peach'] : ['blue'], icon: 'calendar'
    }));
    const model = createTodayMonthViewModel({ date: new Date(2026, 9, 9), annotations: [], events });
    const { body } = render(TodayMonthGrid, { props: { model, selectedDateKey: '2026-10-10' } });
    expect(body.match(/class="calendar-record-dot /g)).toHaveLength(2);
    expect(body).toContain('+6');
    expect(body).toContain('var(--color-blue)');
    expect(body).toContain('var(--color-peach)');
    expect(body.match(/aria-current="date"/g)).toHaveLength(1);
    expect(body).not.toContain('today-month-day__event-count');
  } finally { vi.useRealTimers(); }
});

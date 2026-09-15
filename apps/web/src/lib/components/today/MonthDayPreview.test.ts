import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import MonthDayPreview from './MonthDayPreview.svelte';
import { createTodayMonthViewModel } from '$lib/today/today-month-calendar';
import { createTodayViewModel } from '$lib/today/today-view-model';

function props() {
  const event = { ...createTodayViewModel({ fixture: 'desktop-reference' }).weekEvents[0], day: '2026-09-15', itemId: 'item', allDay: true };
  const model = createTodayMonthViewModel({ date: new Date(2026, 8, 15), annotations: [], events: [event] });
  const day = model.weeks.flatMap(week => week.days).find(day => day.dateKey === event.day)!;
  return { day, anchor: {} as HTMLElement, touch: true, onclose() {}, onenter() {}, onleave() {} };
}

describe('Day preview', () => {
  it('labels all-day events, includes a category icon and preserves the day navigation', () => {
    const { body } = render(MonthDayPreview, { props: props() });
    expect(body).toContain('Весь день');
    expect(body).toContain('day-preview__event-icon');
    expect(body).toContain('/app/today?date=2026-09-15&amp;view=day');
    expect(body).toContain('Закрыть сводку дня');
  });
  it('keeps an explicit loading state and disables entries without an item', () => {
    const input = props(); input.day.events[0].itemId = undefined;
    const { body } = render(MonthDayPreview, { props: { ...input, loading: true } });
    expect(body).toContain('Загружаем события');
    expect(body).toMatch(/class="day-preview__event[^>]+disabled/);
  });
});

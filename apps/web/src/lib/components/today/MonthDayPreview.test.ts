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
  it('shows annual special-date anniversaries but not one-time ages', () => {
    const input = props();
    const annotation = { id: 'anniversary', family: 'family', kind: 'family_date' as const, title: 'Годовщина', originDate: '2010-09-15',
      month: 9, day: 15, recurrence: 'yearly' as const, color: 'peach' as const, tone: 'positive' as const, visibility: 'family' as const, source: 'manual' as const, readonly: false };
    input.day.annotations = [annotation];
    for (const touch of [false, true]) expect(render(MonthDayPreview, { props: { ...input, touch } }).body).toContain('Исполняется 16 лет');
    input.day.annotations = [{ ...annotation, recurrence: 'one_time', year: 2026 }];
    expect(render(MonthDayPreview, { props: input }).body).not.toContain('Исполняется');
  });
  it('shows birthday age in hover and touch previews', () => {
    const input = props();
    input.day.annotations = [{ id: 'birthday', family: 'family', kind: 'birthday', title: 'День рождения · Ева', birthDate: '2018-09-15',
      month: 9, day: 15, recurrence: 'yearly', color: 'peach', tone: 'positive', visibility: 'family', source: 'family_member', readonly: true }];
    for (const touch of [false, true]) expect(render(MonthDayPreview, { props: { ...input, touch } }).body).toContain('Исполняется 8 лет');
  });
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

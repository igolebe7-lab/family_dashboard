import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import TodayWeekBoard from './TodayWeekBoard.svelte';
import CalendarEventCard from './CalendarEventCard.svelte';
import { createTodayViewModel } from '$lib/today/today-view-model';

describe('Today calendar controls', () => {
  it('offers all three mobile views and renders a scrollable seven-column week', () => {
    const model = createTodayViewModel({ fixture: 'desktop-reference' });
    const { body } = render(TodayWeekBoard, { props: {
      mobile: true, initialView: 'week', selectedDate: new Date(2024, 4, 24), selectedDateKey: '2024-05-24',
      weekLabel: model.weekLabel, days: model.weekDays,
      events: model.weekEvents.map(event => ({ ...event, itemId: 'abcdefghijklmno' }))
    } });
    expect(body).toMatch(/aria-pressed="true"[^>]*>Неделя/);
    expect(body).toContain('>День</button>');
    expect(body).toContain('>Месяц</button>');
    expect(body.match(/class="week-agenda__day[" ]/g)).toHaveLength(7);
    expect(body).toContain('week-agenda');
    expect(body).toContain('today-timeline-item__card');
    expect(body).not.toContain('week-calendar__events-layer');
    expect(body).toContain('Семейный ужин');
    expect(body).toContain('/app/today?date=2024-05-31&amp;view=week');
  });
  it('keeps a one-hour card compact without overlapping participant metadata', () => {
    const event = { ...createTodayViewModel({ fixture: 'desktop-reference' }).weekEvents[0], durationMinutes: 60 };
    const { body } = render(CalendarEventCard, { props: { event, positionStyle: 'top:608px;height:76px;' } });
    expect(body).toContain('calendar-event-card--compact');
    expect(body).not.toContain('calendar-event-card__avatar');
    expect(body).toMatch(new RegExp(`<time[^>]*>${event.start}</time>`));
    expect(body).toContain(`aria-label="${event.title}, ${event.start}, ${event.memberName}"`);
  });
  it('stacks overlapping events as readable agenda rows on desktop', () => {
    const model = createTodayViewModel({ fixture: 'desktop-reference' });
    const event = model.weekEvents[0];
    const { body } = render(TodayWeekBoard, { props: {
      initialView: 'week', selectedDate: new Date(2024, 4, 24), selectedDateKey: '2024-05-24',
      weekLabel: model.weekLabel, days: model.weekDays,
      events: [event, { ...event, id: `${event.id}-overlap` }]
    } });
    expect(body.match(/class="today-timeline-item__card"/g)).toHaveLength(2);
    expect(body).not.toContain('position:absolute');
    expect(body).toContain('tabindex="0"');
  });
  it('uses the same agenda rows for the desktop day, sorted by time', () => {
    const model = createTodayViewModel({ fixture: 'desktop-reference' });
    const event = model.weekEvents[0];
    const { body } = render(TodayWeekBoard, { props: {
      initialView: 'day', selectedDate: new Date(event.day + 'T12:00:00'), selectedDateKey: event.day,
      weekLabel: model.weekLabel, days: model.weekDays,
      events: [{ ...event, id: 'later', start: '18:30', title: 'Позднее' }, { ...event, id: 'early', start: '08:00', title: 'Раньше' }]
    } });
    expect(body.match(/class="today-timeline-item__card"/g)).toHaveLength(2);
    expect(body.indexOf('Раньше')).toBeLessThan(body.indexOf('Позднее'));
    expect(body).not.toContain('calendar-event-card');
  });
  it('renders working period links and the selected monthly heading', () => {
    const model = createTodayViewModel(new Date(2026, 5, 10));
    const { body } = render(TodayWeekBoard, { props: {
      initialView: 'month', selectedDate: new Date(2026, 5, 10), selectedDateKey: '2026-06-10',
      weekLabel: model.weekLabel, days: model.weekDays
    } });
    expect(body).toContain('/app/today?date=2026-05-10&amp;view=month');
    expect(body).toContain('/app/today?date=2026-07-10&amp;view=month');
    expect(body).toContain('aria-expanded="false"');
  });

  it('links a real event to its item details', () => {
    const event = { ...createTodayViewModel({ fixture: 'desktop-reference' }).weekEvents[0], itemId: 'item123' };
    const { body } = render(CalendarEventCard, { props: { event } });
    expect(body).toContain('href="/app/items/item123"');
  });
});

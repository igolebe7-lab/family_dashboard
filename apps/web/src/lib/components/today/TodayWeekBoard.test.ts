import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import TodayWeekBoard from './TodayWeekBoard.svelte';
import CalendarEventCard from './CalendarEventCard.svelte';
import { createTodayViewModel } from '$lib/today/today-view-model';

describe('Today calendar controls', () => {
  it('keeps a one-hour card compact without overlapping participant metadata', () => {
    const event = { ...createTodayViewModel({ fixture: 'desktop-reference' }).weekEvents[0], durationMinutes: 60 };
    const { body } = render(CalendarEventCard, { props: { event, positionStyle: 'top:608px;height:76px;' } });
    expect(body).toContain('calendar-event-card--compact');
    expect(body).not.toContain('calendar-event-card__avatar');
    expect(body).toMatch(new RegExp(`<time[^>]*>${event.start}</time>`));
    expect(body).toContain(`aria-label="${event.title}, ${event.start}, ${event.memberName}"`);
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

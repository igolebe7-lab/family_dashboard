import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import AgendaList from './AgendaList.svelte';
import { createTodayViewModel } from '$lib/today/today-view-model';

describe('Compact agenda', () => {
  it('renders only actual entries, with all-day entries before timed ones', () => {
    const event = createTodayViewModel({ fixture: 'desktop-reference' }).weekEvents[0];
    const events = [
      { ...event, id: 'late', start: '23:00', title: 'Поздно' },
      { ...event, id: 'all-day', allDay: true, title: 'Без времени' },
      { ...event, id: 'early', start: '06:00', title: 'Рано' }
    ];
    const { body } = render(AgendaList, { props: { events } });
    expect(body.indexOf('Без времени')).toBeLessThan(body.indexOf('Рано'));
    expect(body.indexOf('Рано')).toBeLessThan(body.indexOf('Поздно'));
    expect(body).toContain('Весь день');
    expect(body).not.toContain('12:00');
    expect(body.match(/class="today-timeline-item__card"/g)).toHaveLength(3);
    expect(events[0].id).toBe('late');
  });
  it('shows a short empty state instead of empty hour slots', () => {
    const { body } = render(AgendaList);
    expect(body).toContain('Нет записей');
    expect(body).not.toContain('<time');
    expect(body).not.toContain('today-timeline-item__card');
  });
});

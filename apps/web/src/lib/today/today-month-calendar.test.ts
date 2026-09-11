import { describe, expect, it } from 'vitest';

import type { DayAnnotation } from '$lib/types/domain';
import { createTodayMonthViewModel } from './today-month-calendar';
import type { TodayWeekEvent } from './today-view-model';

const birthday: DayAnnotation = {
  id: 'birthday_vladimir',
  family: 'family_1',
  kind: 'birthday',
  title: 'День рождения Владимира',
  month: 6,
  day: 18,
  recurrence: 'yearly',
  color: 'blue',
  tone: 'positive',
  visibility: 'family',
  source: 'manual',
  readonly: false
};

const event: TodayWeekEvent = {
  id: 'training',
  day: '2026-06-18',
  title: 'Тренировка',
  memberName: 'Аня',
  memberInitial: 'А',
  memberPortrait: 'anya',
  color: 'peach',
  start: '18:00',
  durationMinutes: 60,
  icon: 'dumbbell'
};

describe('createTodayMonthViewModel', () => {
  it('includes sorted clickable events and boundary days without mutating input', () => {
    const events = [{ ...event, id: 'late', itemId: 'late', start: '19:00' },
      { ...event, id: 'early', itemId: 'early', start: '08:00' },
      { ...event, id: 'boundary', day: '2026-07-01' }];
    const model = createTodayMonthViewModel({ annotations: [], date: new Date(2026, 5, 18), events });
    const days = model.weeks.flatMap(week => week.days);
    expect(days.find(day => day.dateKey === '2026-06-18')?.events.map(event => event.id)).toEqual(['early', 'late']);
    expect(days.find(day => day.dateKey === '2026-07-01')?.eventCount).toBe(1);
    expect(events[0].id).toBe('late');
  });
  it('creates the selected month with week numbers and day metadata', () => {
    const model = createTodayMonthViewModel({
      annotations: [birthday],
      date: new Date(2026, 5, 18),
      events: [event]
    });

    const day = model.weeks.flatMap((week) => week.days).find((item) => item.dateKey === '2026-06-18');

    expect(model.label).toBe('Июнь 2026');
    expect(model.weekdayLabels).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(day).toMatchObject({
      day: 18,
      eventCount: 1,
      primaryAnnotationTitle: 'День рождения Владимира'
    });
  });
});

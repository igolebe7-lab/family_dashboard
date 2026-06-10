import { describe, expect, it } from 'vitest';

import type { DayAnnotation } from '$lib/types/domain';
import { createYearCalendarViewModel } from './year-calendar';

const birthday: DayAnnotation = {
  id: 'birthday_vladimir',
  family: 'family_1',
  kind: 'birthday',
  title: 'День рождения Владимира',
  month: 3,
  day: 12,
  recurrence: 'yearly',
  color: 'blue',
  tone: 'positive',
  visibility: 'family',
  source: 'manual',
  readonly: false,
  personName: 'Владимир',
  personRelation: 'коллега'
};

const holiday: DayAnnotation = {
  id: 'new_year_2026',
  family: 'family_1',
  kind: 'public_holiday',
  title: 'Новый год',
  month: 1,
  day: 1,
  year: 2026,
  recurrence: 'one_time',
  color: 'gray',
  tone: 'system',
  visibility: 'family',
  source: 'nager_date',
  readonly: true,
  countryCode: 'RU'
};

describe('createYearCalendarViewModel', () => {
  it('creates twelve month cards with week rows and ISO week numbers', () => {
    const model = createYearCalendarViewModel(2026, []);

    expect(model.year).toBe(2026);
    expect(model.months).toHaveLength(12);
    expect(model.months[0].label).toBe('Январь');
    expect(model.months[0].weeks[0].weekNumber).toBe(1);
    expect(model.months[0].weeks[0].days[0]).toMatchObject({
      dateKey: '2025-12-29',
      inCurrentMonth: false
    });
  });

  it('marks weekends and attaches day annotations to matching dates', () => {
    const model = createYearCalendarViewModel(2026, [birthday, holiday]);
    const januaryFirst = model.daysByDate.get('2026-01-01');
    const marchTwelfth = model.daysByDate.get('2026-03-12');
    const januaryThird = model.daysByDate.get('2026-01-03');

    expect(januaryFirst?.annotations.map((annotation) => annotation.id)).toEqual(['new_year_2026']);
    expect(marchTwelfth?.annotations.map((annotation) => annotation.id)).toEqual(['birthday_vladimir']);
    expect(januaryThird?.isWeekend).toBe(true);
  });

  it('limits visible markers while preserving overflow count', () => {
    const annotations = [
      birthday,
      { ...birthday, id: 'a2', title: 'Вторая дата', kind: 'family_date' as const },
      { ...birthday, id: 'a3', title: 'Третья дата', kind: 'observance' as const },
      { ...birthday, id: 'a4', title: 'Четвёртая дата', kind: 'memorial' as const }
    ];

    const model = createYearCalendarViewModel(2026, annotations, { markerLimit: 2 });
    const day = model.daysByDate.get('2026-03-12');

    expect(day?.visibleAnnotations).toHaveLength(2);
    expect(day?.hiddenAnnotationCount).toBe(2);
  });
});

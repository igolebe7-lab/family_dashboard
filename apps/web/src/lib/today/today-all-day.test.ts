import { describe, expect, it } from 'vitest';

import type { DayAnnotation } from '$lib/types/domain';
import { createTodayAllDayInfoViewModel } from './today-all-day';

const annotations: DayAnnotation[] = [
  {
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
    readonly: false,
    personName: 'Владимир',
    personRelation: 'коллега'
  },
  {
    id: 'family_trip',
    family: 'family_1',
    kind: 'family_date',
    title: 'Начало поездки',
    month: 6,
    day: 18,
    year: 2026,
    recurrence: 'one_time',
    color: 'green',
    tone: 'important',
    visibility: 'family',
    source: 'manual',
    readonly: false
  },
  {
    id: 'new_year',
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
    readonly: true
  }
];

describe('createTodayAllDayInfoViewModel', () => {
  it('maps selected day annotations into a calm all-day strip', () => {
    const model = createTodayAllDayInfoViewModel({
      date: new Date(2026, 5, 18),
      annotations
    });

    expect(model).toEqual({
      dateKey: '2026-06-18',
      title: 'Информация о дне',
      subtitle: '2 особые даты',
      items: [
        expect.objectContaining({
          id: 'birthday_vladimir',
          title: 'День рождения Владимира',
          meta: 'коллега',
          kindLabel: 'День рождения',
          color: 'blue'
        }),
        expect.objectContaining({
          id: 'family_trip',
          title: 'Начало поездки',
          meta: 'Особая дата',
          kindLabel: 'Особая дата',
          color: 'green'
        })
      ]
    });
  });

  it('returns an empty strip model without mixing annotations into tasks', () => {
    const model = createTodayAllDayInfoViewModel({
      date: new Date(2026, 5, 19),
      annotations
    });

    expect(model.subtitle).toBe('Нет особых дат');
    expect(model.items).toEqual([]);
  });
});

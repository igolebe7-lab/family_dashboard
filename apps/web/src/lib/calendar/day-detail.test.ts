import { describe, expect, it } from 'vitest';

import type { YearCalendarDay } from './year-calendar';
import { createDayDetailViewModel } from './day-detail';

const day: YearCalendarDay = {
  dateKey: '2026-06-18',
  day: 18,
  month: 6,
  inCurrentMonth: true,
  isWeekend: false,
  visibleAnnotations: [],
  hiddenAnnotationCount: 0,
  annotations: [
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
      personRelation: 'коллега',
      personContact: '+7 999 000-00-00'
    },
    {
      id: 'family_trip',
      family: 'family_1',
      kind: 'family_date',
      title: 'Начало поездки',
      month: 6,
      day: 18,
      recurrence: 'one_time',
      year: 2026,
      color: 'green',
      tone: 'important',
      visibility: 'family',
      source: 'manual',
      readonly: false
    }
  ]
};

describe('createDayDetailViewModel', () => {
  it('uses the viewed year for annual special dates', () => {
    const annotations = [{ ...day.annotations[1], recurrence: 'yearly' as const, originDate: '2010-06-18' }];
    expect(createDayDetailViewModel({ ...day, annotations }).items[0].meta).toBe('В этом году 16 лет');
  });
  it('formats the selected day and annotation subtitles', () => {
    const model = createDayDetailViewModel(day);

    expect(model.title).toBe('18 июня');
    expect(model.subtitle).toBe('2 особые даты');
    expect(model.items).toEqual([
      expect.objectContaining({
        id: 'birthday_vladimir',
        title: 'День рождения Владимира',
        meta: 'коллега · +7 999 000-00-00',
        kindLabel: 'День рождения'
      }),
      expect.objectContaining({
        id: 'family_trip',
        title: 'Начало поездки',
        meta: 'Особая дата',
        kindLabel: 'Особая дата'
      })
    ]);
  });

  it('returns a calm empty state when the day has no annotations', () => {
    const model = createDayDetailViewModel({ ...day, annotations: [] });

    expect(model.subtitle).toBe('Нет особых дат');
    expect(model.items).toEqual([]);
  });

  it('shows the age reached in the hovered calendar year', () => {
    const annotations = [{ ...day.annotations[0], birthDate: '2018-06-18' }];
    expect(createDayDetailViewModel({ ...day, annotations }).items[0].meta).toBe('Исполняется 8 лет · коллега · +7 999 000-00-00');
    expect(createDayDetailViewModel({ ...day, dateKey: '2039-06-18', annotations }).items[0].meta).toContain('Исполняется 21 год');
    expect(createDayDetailViewModel({ ...day, dateKey: '2040-06-18', annotations }).items[0].meta).toContain('Исполняется 22 года');
  });
});

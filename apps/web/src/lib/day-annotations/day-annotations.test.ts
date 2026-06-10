import { describe, expect, it } from 'vitest';

import type { DayAnnotation } from '$lib/types/domain';
import {
  getAnnotationDateForYear,
  getAnnotationsForDate,
  getAnnotationsForYear,
  sortDayAnnotations
} from './day-annotations';

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
  personRelation: 'коллега',
  personContact: '+7 999 000-00-00',
  createdBy: 'member_mom'
};

const oneTimeDate: DayAnnotation = {
  id: 'school_start',
  family: 'family_1',
  kind: 'family_date',
  title: 'Первый день школы',
  month: 9,
  day: 1,
  year: 2026,
  recurrence: 'one_time',
  color: 'green',
  tone: 'important',
  visibility: 'family',
  source: 'manual',
  readonly: false,
  createdBy: 'member_mom'
};

const publicHoliday: DayAnnotation = {
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
  countryCode: 'RU',
  sourceUid: 'RU-2026-01-01-NewYear',
  fetchedAt: '2026-06-10T10:00:00.000Z'
};

describe('day annotations', () => {
  it('projects yearly annotations into any selected year', () => {
    expect(getAnnotationDateForYear(birthday, 2026)).toBe('2026-03-12');
    expect(getAnnotationDateForYear(birthday, 2027)).toBe('2027-03-12');
  });

  it('keeps one-time annotations only in their source year', () => {
    expect(getAnnotationDateForYear(oneTimeDate, 2026)).toBe('2026-09-01');
    expect(getAnnotationDateForYear(oneTimeDate, 2027)).toBeNull();
  });

  it('filters annotations for a whole year and a specific date', () => {
    const annotations = [birthday, oneTimeDate, publicHoliday];

    expect(getAnnotationsForYear(annotations, 2027).map((annotation) => annotation.id)).toEqual([
      'birthday_vladimir'
    ]);

    expect(getAnnotationsForDate(annotations, '2026-03-12')).toEqual([birthday]);
  });

  it('sorts system holidays before birthdays and special dates', () => {
    expect(sortDayAnnotations([oneTimeDate, birthday, publicHoliday]).map((annotation) => annotation.id)).toEqual([
      'new_year_2026',
      'birthday_vladimir',
      'school_start'
    ]);
  });
});

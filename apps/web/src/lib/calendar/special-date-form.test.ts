import { describe, expect, it } from 'vitest';

import type { DayAnnotation } from '$lib/types/domain';
import {
  createSpecialDateFormValues,
  createSpecialDateInput,
  validateSpecialDateForm
} from './special-date-form';

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
  readonly: false,
  personName: 'Владимир',
  personRelation: 'коллега',
  personContact: '+7 999 000-00-00',
  description: 'Позвонить утром'
};

describe('special date form model', () => {
  it('creates defaults from the selected date', () => {
    const values = createSpecialDateFormValues({
      selectedDate: new Date(2026, 5, 18)
    });

    expect(values).toMatchObject({
      kind: 'family_date',
      title: '',
      month: 6,
      day: 18,
      year: 2026,
      recurrence: 'yearly',
      color: 'green',
      tone: 'positive',
      visibility: 'family'
    });
  });

  it('hydrates existing annotation values for editing', () => {
    const values = createSpecialDateFormValues({ annotation: birthday });

    expect(values).toMatchObject({
      kind: 'birthday',
      title: 'День рождения Владимира',
      month: 6,
      day: 18,
      recurrence: 'yearly',
      color: 'blue',
      personName: 'Владимир',
      personRelation: 'коллега',
      personContact: '+7 999 000-00-00',
      description: 'Позвонить утром'
    });
  });

  it('normalizes yearly and one-time payloads for the API', () => {
    const yearly = createSpecialDateInput({
      ...createSpecialDateFormValues(),
      title: 'Годовщина',
      recurrence: 'yearly',
      year: 2026
    });
    const oneTime = createSpecialDateInput({
      ...createSpecialDateFormValues(),
      title: 'Поездка',
      recurrence: 'one_time',
      year: 2026
    });

    expect(yearly).toEqual(expect.objectContaining({ title: 'Годовщина', year: undefined }));
    expect(oneTime).toEqual(expect.objectContaining({ title: 'Поездка', year: 2026 }));
  });

  it('derives birthday title from person data', () => {
    const input = createSpecialDateInput({
      ...createSpecialDateFormValues(),
      kind: 'birthday',
      title: '',
      personName: 'Владимир',
      personRelation: 'коллега'
    });

    expect(input).toEqual(
      expect.objectContaining({
        title: 'День рождения Владимир',
        personName: 'Владимир',
        personRelation: 'коллега'
      })
    );
  });

  it('validates required title and real calendar date', () => {
    expect(
      validateSpecialDateForm({
        ...createSpecialDateFormValues(),
        title: '',
        month: 2,
        day: 31
      })
    ).toEqual(['Добавьте название', 'Проверьте дату']);
  });

  it('validates required birthday person name', () => {
    expect(
      validateSpecialDateForm({
        ...createSpecialDateFormValues(),
        kind: 'birthday',
        title: ''
      })
    ).toEqual(['Добавьте имя именинника', 'Укажите дату рождения']);
  });

  it('uses the actual birth date, not the selected calendar year', () => {
    const values = { ...createSpecialDateFormValues({ selectedDate: new Date(2026, 9, 8) }),
      kind: 'birthday' as const, personName: 'Ева', birthDate: '2018-02-28', recurrence: 'one_time' as const };
    expect(validateSpecialDateForm(values)).toEqual([]);
    expect(createSpecialDateInput(values)).toMatchObject({ birthDate: '2018-02-28', month: 2, day: 28, recurrence: 'yearly', year: undefined });
    expect(createSpecialDateFormValues({ annotation: { ...birthday, birthDate: '1985-06-18' } }).birthDate).toBe('1985-06-18');
  });

  it('rejects nonexistent and future birth dates without guessing a legacy birth year', () => {
    const values = { ...createSpecialDateFormValues(), kind: 'birthday' as const, personName: 'Ева' };
    for (const birthDate of ['2018-02-29', '2200-01-01']) {
      expect(validateSpecialDateForm({ ...values, birthDate })).toContain('Проверьте дату рождения');
    }
    expect(validateSpecialDateForm({ ...values, birthDate: '2020-02-29' })).toEqual([]);
    expect(createSpecialDateFormValues({ annotation: birthday }).birthDate).toBe('');
  });
});

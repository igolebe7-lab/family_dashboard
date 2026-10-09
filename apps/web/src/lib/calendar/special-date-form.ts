import type { DayAnnotationInput } from '$lib/api/day-annotations.api';
import type { AccentColor } from '$lib/constants/colors';
import type { DayAnnotation, DayAnnotationKind, DayAnnotationRecurrence, DayAnnotationTone } from '$lib/types/domain';

export type SpecialDateFormValues = {
  kind: DayAnnotationKind;
  title: string;
  description: string;
  month: number;
  day: number;
  year: number;
  birthDate: string;
  originDate: string;
  recurrence: DayAnnotationRecurrence;
  color: AccentColor;
  tone: DayAnnotationTone;
  visibility: DayAnnotation['visibility'];
  personName: string;
  personRelation: string;
  personContact: string;
};

export type SpecialDateFormOptions = {
  annotation?: DayAnnotation;
  selectedDate?: Date;
};

export function createSpecialDateFormValues(
  options: SpecialDateFormOptions = {}
): SpecialDateFormValues {
  if (options.annotation) return createValuesFromAnnotation(options.annotation, options.selectedDate);

  const selectedDate = options.selectedDate ?? new Date();

  return {
    kind: 'family_date',
    title: '',
    description: '',
    month: selectedDate.getMonth() + 1,
    day: selectedDate.getDate(),
    year: selectedDate.getFullYear(),
    birthDate: '',
    originDate: '',
    recurrence: 'yearly',
    color: 'green',
    tone: 'positive',
    visibility: 'family',
    personName: '',
    personRelation: '',
    personContact: ''
  };
}

export function createSpecialDateInput(values: SpecialDateFormValues): DayAnnotationInput {
  const title = values.kind === 'birthday' ? createBirthdayTitle(values.personName) : values.title.trim();
  const birthday = values.kind === 'birthday';
  const [birthYear, birthMonth, birthDay] = values.birthDate.split('-').map(Number);
  const recurrence = birthday ? 'yearly' : values.recurrence;
  const originDate = !birthday && recurrence === 'yearly' ? values.originDate : '';
  const [, originMonth, originDay] = originDate.split('-').map(Number);

  return {
    kind: values.kind,
    title,
    description: optionalString(values.description),
    month: birthday && birthYear ? birthMonth : originDate ? originMonth : values.month,
    day: birthday && birthYear ? birthDay : originDate ? originDay : values.day,
    birthDate: birthday ? values.birthDate : '',
    originDate,
    year: recurrence === 'one_time' ? values.year : undefined,
    recurrence,
    color: values.color,
    tone: values.tone,
    visibility: values.visibility,
    personName: values.kind === 'birthday' ? optionalString(values.personName) : undefined,
    personRelation: values.kind === 'birthday' ? optionalString(values.personRelation) : undefined,
    personContact: values.kind === 'birthday' ? optionalString(values.personContact) : undefined
  };
}

export function validateSpecialDateForm(values: SpecialDateFormValues): string[] {
  const errors: string[] = [];

  if (values.kind === 'birthday') {
    if (!values.personName.trim()) errors.push('Добавьте имя именинника');
    if (!values.birthDate) errors.push('Укажите дату рождения');
    else {
      const [year, month, day] = values.birthDate.split('-').map(Number);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate) || year < 1900 ||
        !isValidMonthDay(month, day, year) || values.birthDate > localToday()) errors.push('Проверьте дату рождения');
    }
  } else if (!values.title.trim()) {
    errors.push('Добавьте название');
  }
  if (values.kind !== 'birthday') {
    if (values.recurrence === 'yearly' && values.originDate) {
      const [year, month, day] = values.originDate.split('-').map(Number);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.originDate) || year < 1000 ||
          !isValidMonthDay(month, day, year)) errors.push('Проверьте дату начала');
    } else if (!isValidMonthDay(values.month, values.day, values.recurrence === 'yearly' ? 2024 : values.year)) errors.push('Проверьте дату');
    if (values.recurrence === 'one_time' && !Number.isInteger(values.year)) errors.push('Проверьте год');
  }

  return errors;
}

function createBirthdayTitle(personName: string): string {
  const name = personName.trim();
  return name ? `День рождения ${name}` : 'День рождения';
}

function createValuesFromAnnotation(annotation: DayAnnotation, selectedDate?: Date): SpecialDateFormValues {
  return {
    kind: annotation.kind,
    title: annotation.title,
    description: annotation.description ?? '',
    month: annotation.month,
    day: annotation.day,
    year: annotation.recurrence === 'one_time' && annotation.year
      ? annotation.year : (selectedDate ?? new Date()).getFullYear(),
    birthDate: annotation.birthDate?.slice(0, 10) ?? '',
    originDate: annotation.originDate?.slice(0, 10) ?? '',
    recurrence: annotation.recurrence,
    color: annotation.color,
    tone: annotation.tone,
    visibility: annotation.visibility,
    personName: annotation.personName ?? '',
    personRelation: annotation.personRelation ?? '',
    personContact: annotation.personContact ?? ''
  };
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isValidMonthDay(month: number, day: number, year: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

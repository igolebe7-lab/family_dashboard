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
  if (options.annotation) return createValuesFromAnnotation(options.annotation);

  const selectedDate = options.selectedDate ?? new Date();

  return {
    kind: 'family_date',
    title: '',
    description: '',
    month: selectedDate.getMonth() + 1,
    day: selectedDate.getDate(),
    year: selectedDate.getFullYear(),
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
  return {
    kind: values.kind,
    title: values.title.trim(),
    description: optionalString(values.description),
    month: values.month,
    day: values.day,
    year: values.recurrence === 'one_time' ? values.year : undefined,
    recurrence: values.recurrence,
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

  if (!values.title.trim()) errors.push('Добавьте название');
  if (!isValidMonthDay(values.month, values.day, values.year)) errors.push('Проверьте дату');
  if (values.recurrence === 'one_time' && !Number.isInteger(values.year)) errors.push('Проверьте год');

  return errors;
}

function createValuesFromAnnotation(annotation: DayAnnotation): SpecialDateFormValues {
  return {
    kind: annotation.kind,
    title: annotation.title,
    description: annotation.description ?? '',
    month: annotation.month,
    day: annotation.day,
    year: annotation.year ?? new Date().getFullYear(),
    recurrence: annotation.recurrence,
    color: annotation.color,
    tone: annotation.tone,
    visibility: annotation.visibility,
    personName: annotation.personName ?? '',
    personRelation: annotation.personRelation ?? '',
    personContact: annotation.personContact ?? ''
  };
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

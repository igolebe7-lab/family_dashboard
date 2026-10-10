import type { DayAnnotation, DayAnnotationKind } from '$lib/types/domain';

const KIND_ORDER: Record<DayAnnotationKind, number> = {
  public_holiday: 0,
  birthday: 1,
  family_date: 2,
  memorial: 3,
  observance: 4
};

export type UpcomingBirthday = { annotation: DayAnnotation; dateKey: string; daysLeft: number };

export function birthdayWindowDates(todayKey: string): string[] {
  const today = new Date(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(today.getTime()) || today.toISOString().slice(0, 10) !== todayKey) return [];
  return Array.from({ length: 4 }, (_, offset) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  });
}

export function getUpcomingBirthdays(annotations: readonly DayAnnotation[], todayKey: string): UpcomingBirthday[] {
  return birthdayWindowDates(todayKey).flatMap((dateKey, daysLeft) =>
    getAnnotationsForDate(annotations, dateKey)
      .filter(annotation => annotation.kind === 'birthday')
      .map(annotation => ({ annotation, dateKey, daysLeft }))
  );
}

export function getAnnotationDateForYear(annotation: DayAnnotation, year: number): string | null {
  if (annotation.kind === 'birthday' && annotation.birthDate && year < Number(annotation.birthDate.slice(0, 4))) return null;
  if (annotation.recurrence === 'yearly' && annotation.originDate && year < Number(annotation.originDate.slice(0, 4))) return null;
  if (annotation.recurrence === 'one_time' && annotation.year !== year) return null;
  if (!isValidMonthDay(annotation.month, annotation.day, year)) return null;

  return formatDateKey(year, annotation.month, annotation.day);
}

export function formatBirthdayMeta(annotation: DayAnnotation, year: number): string {
  const birthYear = Number(annotation.birthDate?.slice(0, 4));
  const age = year - birthYear;
  const unit = new Intl.PluralRules('ru').select(age);
  const ageLabel = birthYear > 0 && Number.isInteger(age) && age >= 0
    ? `Исполняется ${age} ${unit === 'one' ? 'год' : unit === 'few' ? 'года' : 'лет'}` : '';
  return [ageLabel, annotation.personRelation, annotation.personContact].filter(Boolean).join(' · ') || 'День рождения';
}

export function formatAnniversaryMeta(annotation: DayAnnotation, year: number): string {
  if (annotation.kind === 'birthday' || annotation.recurrence !== 'yearly' || !annotation.originDate) return '';
  const years = year - Number(annotation.originDate.slice(0, 4));
  if (!Number.isInteger(years) || years < 0) return '';
  if (years === 0) return 'Первая дата';
  const unit = new Intl.PluralRules('ru').select(years);
  return `В этом году ${years} ${unit === 'one' ? 'год' : unit === 'few' ? 'года' : 'лет'}`;
}

export function getAnnotationsForYear(
  annotations: readonly DayAnnotation[],
  year: number
): DayAnnotation[] {
  return sortDayAnnotations(
    annotations.filter((annotation) => getAnnotationDateForYear(annotation, year) !== null)
  );
}

export function getAnnotationsForDate(
  annotations: readonly DayAnnotation[],
  dateKey: string
): DayAnnotation[] {
  const year = Number(dateKey.slice(0, 4));

  return sortDayAnnotations(
    annotations.filter((annotation) => getAnnotationDateForYear(annotation, year) === dateKey)
  );
}

export function sortDayAnnotations(
  annotations: readonly DayAnnotation[]
): DayAnnotation[] {
  return [...annotations].sort((left, right) => {
    const kindDifference = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
    if (kindDifference !== 0) return kindDifference;

    return left.title.localeCompare(right.title, 'ru');
  });
}

function isValidMonthDay(month: number, day: number, year: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

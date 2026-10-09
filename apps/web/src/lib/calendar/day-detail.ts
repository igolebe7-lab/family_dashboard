import type { DayAnnotation } from '$lib/types/domain';
import { formatBirthdayMeta, formatAnniversaryMeta } from '$lib/day-annotations/day-annotations';
import type { YearCalendarDay } from './year-calendar';

export type DayDetailItem = {
  id: string;
  title: string;
  meta: string;
  kind: DayAnnotation['kind'];
  kindLabel: string;
  color: DayAnnotation['color'];
  readonly: boolean;
  source: DayAnnotation['source'];
};

export type DayDetailViewModel = {
  dateKey: string;
  title: string;
  subtitle: string;
  items: DayDetailItem[];
};

const MONTH_LABELS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
];

const KIND_LABELS: Record<DayAnnotation['kind'], string> = {
  birthday: 'День рождения',
  public_holiday: 'Праздник',
  family_date: 'Особая дата',
  observance: 'Заметка дня',
  memorial: 'Памятный день'
};

export function createDayDetailViewModel(day: YearCalendarDay): DayDetailViewModel {
  return {
    dateKey: day.dateKey,
    title: `${day.day} ${MONTH_LABELS[day.month - 1] ?? ''}`.trim(),
    subtitle: formatSubtitle(day.annotations.length),
    items: day.annotations.map((annotation) => mapAnnotation(annotation, Number(day.dateKey.slice(0, 4))))
  };
}

function mapAnnotation(annotation: DayAnnotation, year: number): DayDetailItem {
  return {
    id: annotation.id,
    title: annotation.title,
    meta: formatAnnotationMeta(annotation, year),
    kind: annotation.kind,
    kindLabel: KIND_LABELS[annotation.kind],
    color: annotation.color,
    readonly: annotation.readonly,
    source: annotation.source
  };
}

function formatSubtitle(count: number): string {
  if (count === 0) return 'Нет особых дат';
  if (count === 1) return '1 особая дата';
  if (count >= 2 && count <= 4) return `${count} особые даты`;
  return `${count} особых дат`;
}

function formatAnnotationMeta(annotation: DayAnnotation, year: number): string {
  if (annotation.kind === 'birthday') {
    return formatBirthdayMeta(annotation, year);
  }

  return formatAnniversaryMeta(annotation, year) || KIND_LABELS[annotation.kind];
}

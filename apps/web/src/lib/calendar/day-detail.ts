import type { DayAnnotation } from '$lib/types/domain';
import type { YearCalendarDay } from './year-calendar';

export type DayDetailItem = {
  id: string;
  title: string;
  meta: string;
  kind: DayAnnotation['kind'];
  kindLabel: string;
  color: DayAnnotation['color'];
  readonly: boolean;
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
    items: day.annotations.map(mapAnnotation)
  };
}

function mapAnnotation(annotation: DayAnnotation): DayDetailItem {
  return {
    id: annotation.id,
    title: annotation.title,
    meta: formatAnnotationMeta(annotation),
    kind: annotation.kind,
    kindLabel: KIND_LABELS[annotation.kind],
    color: annotation.color,
    readonly: annotation.readonly
  };
}

function formatSubtitle(count: number): string {
  if (count === 0) return 'Нет особых дат';
  if (count === 1) return '1 особая дата';
  if (count >= 2 && count <= 4) return `${count} особые даты`;
  return `${count} особых дат`;
}

function formatAnnotationMeta(annotation: DayAnnotation): string {
  if (annotation.kind === 'birthday') {
    return [annotation.personRelation, annotation.personContact].filter(Boolean).join(' · ') || 'День рождения';
  }

  return KIND_LABELS[annotation.kind];
}

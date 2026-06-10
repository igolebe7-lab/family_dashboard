import { getAnnotationsForDate } from '$lib/day-annotations/day-annotations';
import type { DayAnnotation } from '$lib/types/domain';
import { formatDateKey } from './today-view-model';

export type TodayAllDayInfoItem = {
  id: string;
  title: string;
  meta: string;
  kind: DayAnnotation['kind'];
  kindLabel: string;
  color: DayAnnotation['color'];
  readonly: boolean;
};

export type TodayAllDayInfoViewModel = {
  dateKey: string;
  title: string;
  subtitle: string;
  items: TodayAllDayInfoItem[];
};

export type TodayAllDayInfoInput = {
  date: Date;
  annotations: readonly DayAnnotation[];
};

const KIND_LABELS: Record<DayAnnotation['kind'], string> = {
  birthday: 'День рождения',
  public_holiday: 'Праздник',
  family_date: 'Особая дата',
  observance: 'Заметка дня',
  memorial: 'Памятный день'
};

export function createTodayAllDayInfoViewModel(
  input: TodayAllDayInfoInput
): TodayAllDayInfoViewModel {
  const dateKey = formatDateKey(input.date);
  const annotations = getAnnotationsForDate(input.annotations, dateKey);

  return {
    dateKey,
    title: 'Информация о дне',
    subtitle: formatSubtitle(annotations.length),
    items: annotations.map(mapAnnotation)
  };
}

function mapAnnotation(annotation: DayAnnotation): TodayAllDayInfoItem {
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

function formatAnnotationMeta(annotation: DayAnnotation): string {
  if (annotation.kind === 'birthday') {
    return [annotation.personRelation, annotation.personContact].filter(Boolean).join(' · ') || 'День рождения';
  }

  return KIND_LABELS[annotation.kind];
}

function formatSubtitle(count: number): string {
  if (count === 0) return 'Нет особых дат';
  if (count === 1) return '1 особая дата';
  if (count >= 2 && count <= 4) return `${count} особые даты`;
  return `${count} особых дат`;
}

import type { DayAnnotation } from '$lib/types/domain';

export const DEMO_DAY_ANNOTATIONS: DayAnnotation[] = [
  {
    id: 'demo_new_year',
    family: 'demo',
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
    countryCode: 'RU'
  },
  {
    id: 'demo_misha_birthday',
    family: 'demo',
    kind: 'birthday',
    title: 'День рождения Миши',
    month: 3,
    day: 12,
    year: 2017,
    recurrence: 'yearly',
    color: 'green',
    tone: 'positive',
    visibility: 'family',
    source: 'family_member',
    readonly: false,
    linkedMember: 'member_misha',
    personName: 'Миша'
  },
  {
    id: 'demo_vladimir_birthday',
    family: 'demo',
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
    id: 'demo_memorial',
    family: 'demo',
    kind: 'memorial',
    title: 'Памятный день',
    month: 9,
    day: 4,
    recurrence: 'yearly',
    color: 'gray',
    tone: 'memorial',
    visibility: 'family',
    source: 'manual',
    readonly: false
  }
];

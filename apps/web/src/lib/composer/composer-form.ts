import type { CreateItemInput } from '$lib/api/items.api';
import type { ItemCategory } from '$lib/constants/categories';
import type { ItemKind, ItemPriority, ItemVisibility } from '$lib/types/domain';

export type ComposerKind = Extract<ItemKind, 'event' | 'task'>;
export type ComposerReminder = 'none' | 'at_time' | 'before_15' | 'before_60' | 'before_day';
export type ComposerRepeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export const COMPOSER_WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type ComposerWeekday = typeof COMPOSER_WEEKDAYS[number];
export const FAMILY_TARGET = '__family__';

export type ComposerFormValues = {
  kind: ComposerKind;
  activeMemberId: string;
  familyMemberIds: string[];
  title: string;
  description: string;
  category: ItemCategory;
  visibility: ItemVisibility;
  priority: ItemPriority;
  date: string;
  startTime: string;
  endTime: string;
  dueTime: string;
  allDay: boolean;
  owner: string;
  assignee: string;
  participants: string[];
  checklistText: string;
  locationText: string;
  reminder: ComposerReminder;
  repeat: ComposerRepeat;
  repeatInterval: number;
  // Undefined follows the selected date; an empty array is an invalid explicit selection.
  repeatDays: ComposerWeekday[] | undefined;
  repeatUntil: string;
  approvalRequired: boolean;
  points: string;
};

export type ComposerSubmitResult =
  | { ok: true; input: CreateItemInput }
  | { ok: false; errors: string[] };

export function createComposerFormValues(input: {
  activeMemberId?: string;
  date?: Date;
  kind?: ComposerKind;
} = {}): ComposerFormValues {
  const date = formatDateInputValue(input.date ?? new Date());

  return {
    kind: input.kind ?? 'event',
    activeMemberId: input.activeMemberId ?? '',
    familyMemberIds: input.activeMemberId ? [input.activeMemberId] : [],
    title: '',
    description: '',
    category: input.kind === 'task' ? 'home' : 'family',
    visibility: input.kind === 'task' ? 'private' : 'family',
    priority: 'normal',
    date,
    startTime: '09:00',
    endTime: '10:00',
    dueTime: '18:00',
    allDay: false,
    owner: input.activeMemberId ?? '',
    assignee: '',
    participants: input.activeMemberId ? [input.activeMemberId] : [],
    checklistText: '',
    locationText: '',
    reminder: 'none',
    repeat: 'none',
    repeatInterval: 1,
    repeatDays: undefined,
    repeatUntil: '',
    approvalRequired: false,
    points: ''
  };
}

export function createComposerItemInput(values: ComposerFormValues, timezone: string): ComposerSubmitResult {
  const errors = validateComposerForm(values);
  if (errors.length > 0) return { ok: false, errors };
  const familyMemberIds = getFamilyMemberIds(values);
  let startAt: string | undefined;
  let endAt: string | undefined;
  let dueAt: string | undefined;
  let recurrenceUntil: string | undefined;
  try {
    if (values.kind === 'event') {
      startAt = createDateTimeIso(values.date, values.allDay ? '00:00' : values.startTime, timezone);
      endAt = createDateTimeIso(values.date, values.allDay ? '23:59' : values.endTime, timezone);
    } else {
      dueAt = createDateTimeIso(values.date, values.dueTime, timezone);
    }
    if (values.repeat !== 'none' && values.repeatUntil) {
      // Include the whole final local date, not midnight at its beginning.
      recurrenceUntil = new Date(Date.parse(createDateTimeIso(values.repeatUntil, '23:59', timezone)) + 59_999).toISOString();
    }
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : 'Проверьте дату и часовой пояс семьи'] };
  }

  const base = {
    kind: values.kind,
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    category: values.category,
    priority: values.priority,
    visibility: values.visibility,
    timezone,
    recurrenceRule: createRecurrenceRule(values),
    recurrenceUntil,
    reminderOffsetMinutes: createReminderOffsetMinutes(values.reminder)
  } satisfies Partial<CreateItemInput>;

  if (values.kind === 'event') {
    return {
      ok: true,
      input: {
        ...base,
        kind: 'event',
        allDay: values.allDay,
        startAt,
        endAt,
        participants: getEventParticipants(values, familyMemberIds),
        locationText: values.locationText.trim() || undefined
      } as CreateItemInput
    };
  }

  if (values.kind === 'task' && values.owner === FAMILY_TARGET) {
    return {
      ok: true,
      input: {
        ...base,
        kind: 'assignment',
        visibility: 'family',
        assignees: familyMemberIds,
        dueAt,
        approvalRequired: values.approvalRequired,
        points: values.points ? Number(values.points) : undefined
      } as CreateItemInput
    };
  }

  if (values.kind === 'task' && values.owner === values.activeMemberId) {
    return {
      ok: true,
      input: {
        ...base,
        kind: 'task',
        owner: values.owner,
        dueAt,
        checklist: createChecklist(values.checklistText)
      } as CreateItemInput
    };
  }

  return {
    ok: true,
    input: {
      ...base,
      kind: 'assignment',
      visibility: 'assignees',
      assignees: [values.owner],
      dueAt,
      approvalRequired: values.approvalRequired,
      points: values.points ? Number(values.points) : undefined
    } as CreateItemInput
  };
}

export function validateComposerForm(values: ComposerFormValues): string[] {
  const errors: string[] = [];
  const title = values.title.trim();

  if (!title) errors.push('Название обязательно');
  if (title.length > 120) errors.push('Название слишком длинное');
  if (!isValidDateInput(values.date)) errors.push('Проверьте дату');
  if (values.repeat !== 'none') {
    if (!Number.isInteger(values.repeatInterval) || values.repeatInterval < 1 || values.repeatInterval > 52) {
      errors.push('Интервал повтора должен быть целым числом от 1 до 52');
    }
    if (values.repeat === 'weekly' && getComposerRepeatDays(values.date, values.repeatDays).length === 0) {
      errors.push('Выберите хотя бы один день недели');
    }
    if (values.repeatUntil && !isValidDateInput(values.repeatUntil)) errors.push('Проверьте дату окончания повтора');
    else if (values.repeatUntil && values.repeatUntil < values.date) errors.push('Окончание повтора не может быть раньше начала');
  }

  if (values.kind === 'event') {
    if (!values.allDay && !isValidTimeInput(values.startTime)) errors.push('Проверьте время начала');
    if (!values.allDay && !isValidTimeInput(values.endTime)) errors.push('Проверьте время окончания');
    if (getEventParticipants(values, getFamilyMemberIds(values)).length === 0) errors.push('Выберите участников события');

    if (!values.allDay && isValidDateInput(values.date) && isValidTimeInput(values.startTime) && isValidTimeInput(values.endTime)) {
      if (values.endTime < values.startTime) {
        errors.push('Окончание не может быть раньше начала');
      }
    }
  }

  if (values.kind === 'task') {
    if (!values.owner) errors.push('Выберите, для кого задача');
    if (values.owner === FAMILY_TARGET && getFamilyMemberIds(values).length === 0) errors.push('Нет участников семьи для задачи');
    if (!isValidTimeInput(values.dueTime)) errors.push('Проверьте время задачи');
    if (values.points && Number(values.points) < 0) errors.push('Баллы не могут быть отрицательными');
  }

  return errors;
}

export function getFamilyMemberIds(values: ComposerFormValues): string[] {
  return Array.from(new Set([...values.familyMemberIds, values.activeMemberId].filter(Boolean)));
}

export function getEventParticipants(values: ComposerFormValues, familyMemberIds = getFamilyMemberIds(values)): string[] {
  if (values.participants.includes(FAMILY_TARGET)) return familyMemberIds;
  return Array.from(new Set(values.participants.filter(Boolean)));
}

export function setComposerKind(values: ComposerFormValues, kind: ComposerKind): ComposerFormValues {
  if (kind === 'event') {
    return {
      ...values,
      kind,
      visibility: values.visibility === 'assignees' ? 'family' : values.visibility
    };
  }

  return {
    ...values,
    kind: 'task',
    category: 'home',
    visibility: values.visibility === 'assignees' ? 'private' : values.visibility
  };
}

export function createDateTimeIso(date: string, time: string, timezone: string): string {
  if (!isValidDateInput(date) || !isValidTimeInput(time)) throw new Error('Проверьте дату и время');
  let formatter: Intl.DateTimeFormat;
  try {
    if (!timezone) throw new Error();
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    throw new Error('Проверьте часовой пояс семьи');
  }
  const wallTime = Date.parse(`${date}T${time}:00Z`);
  const localTimestamp = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
    return Date.parse(`${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  };
  // Probe both sides of nearby transitions, then round-trip each candidate.
  // Gaps have no candidate; folds deliberately choose the earlier instant.
  const offsets = new Set([-36, -12, 0, 12, 36].map((hours) => {
    const probe = wallTime + hours * 3_600_000;
    return localTimestamp(probe) - probe;
  }));
  const candidates = [...offsets].map((offset) => wallTime - offset)
    .filter((instant) => localTimestamp(instant) === wallTime);
  if (!candidates.length) throw new Error(`Время ${time} ${date} не существует в часовом поясе семьи. Выберите другое время`);
  return new Date(Math.min(...candidates)).toISOString();
}

function createChecklist(value: string): { id: string; title: string; done: boolean }[] | undefined {
  const items = value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((title, index) => ({
      id: `check-${index + 1}`,
      title,
      done: false
    }));

  return items.length > 0 ? items : undefined;
}

export function getComposerRepeatDays(date: string, days?: ComposerWeekday[]): ComposerWeekday[] {
  if (days !== undefined) return COMPOSER_WEEKDAYS.filter((day) => days.includes(day));
  if (!isValidDateInput(date)) return [];
  return [COMPOSER_WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]];
}

export function createRecurrenceRule(values: Pick<ComposerFormValues, 'repeat' | 'repeatInterval' | 'repeatDays' | 'date'>): string | undefined {
  if (values.repeat === 'none') return undefined;
  const freq = values.repeat === 'daily' ? 'DAILY' : values.repeat === 'monthly' ? 'MONTHLY' : 'WEEKLY';
  const rule = `FREQ=${freq};INTERVAL=${values.repeatInterval}`;
  if (values.repeat === 'weekdays') return `${rule};BYDAY=MO,TU,WE,TH,FR`;
  if (values.repeat === 'weekly') return `${rule};BYDAY=${getComposerRepeatDays(values.date, values.repeatDays).join(',')}`;
  return rule;
}

function createReminderOffsetMinutes(reminder: ComposerReminder): number | undefined {
  if (reminder === 'at_time') return 0;
  if (reminder === 'before_15') return 15;
  if (reminder === 'before_60') return 60;
  if (reminder === 'before_day') return 1440;
  return undefined;
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T12:00:00Z`);
  return year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

import type { CreateItemInput } from '$lib/api/items.api';
import type { ItemCategory } from '$lib/constants/categories';
import type { ItemKind, ItemPriority, ItemVisibility } from '$lib/types/domain';

export type ComposerKind = Extract<ItemKind, 'event' | 'task' | 'assignment'>;
export type ComposerReminder = 'none' | 'at_time' | 'before_15' | 'before_60' | 'before_day';
export type ComposerRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export type ComposerFormValues = {
  kind: ComposerKind;
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
    title: '',
    description: '',
    category: input.kind === 'assignment' ? 'home' : 'family',
    visibility: input.kind === 'assignment' ? 'assignees' : 'family',
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
    approvalRequired: input.kind === 'assignment',
    points: ''
  };
}

export function createComposerItemInput(values: ComposerFormValues, timezone: string): ComposerSubmitResult {
  const errors = validateComposerForm(values);
  if (errors.length > 0) return { ok: false, errors };

  const base = {
    kind: values.kind,
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    category: values.category,
    priority: values.priority,
    visibility: values.visibility,
    timezone,
    recurrenceRule: createRecurrenceRule(values.repeat),
    reminderOffsetMinutes: createReminderOffsetMinutes(values.reminder)
  } satisfies Partial<CreateItemInput>;

  if (values.kind === 'event') {
    const startAt = createDateTimeIso(values.date, values.startTime);
    const endAt = values.allDay
      ? createDateTimeIso(values.date, '23:59')
      : createDateTimeIso(values.date, values.endTime);

    return {
      ok: true,
      input: {
        ...base,
        kind: 'event',
        allDay: values.allDay,
        startAt,
        endAt,
        participants: values.participants,
        locationText: values.locationText.trim() || undefined
      } as CreateItemInput
    };
  }

  if (values.kind === 'task') {
    return {
      ok: true,
      input: {
        ...base,
        kind: 'task',
        owner: values.owner,
        dueAt: createDateTimeIso(values.date, values.dueTime),
        checklist: createChecklist(values.checklistText)
      } as CreateItemInput
    };
  }

  return {
    ok: true,
    input: {
      ...base,
      kind: 'assignment',
      assignees: [values.assignee],
      dueAt: createDateTimeIso(values.date, values.dueTime),
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

  if (values.kind === 'event') {
    if (!values.allDay && !isValidTimeInput(values.startTime)) errors.push('Проверьте время начала');
    if (!values.allDay && !isValidTimeInput(values.endTime)) errors.push('Проверьте время окончания');
    if (values.participants.length === 0) errors.push('Выберите участников события');

    if (!values.allDay && isValidDateInput(values.date) && isValidTimeInput(values.startTime) && isValidTimeInput(values.endTime)) {
      const startAt = createDateTimeIso(values.date, values.startTime);
      const endAt = createDateTimeIso(values.date, values.endTime);
      if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
        errors.push('Окончание не может быть раньше начала');
      }
    }
  }

  if (values.kind === 'task') {
    if (!values.owner) errors.push('Выберите, для кого дело');
    if (!isValidTimeInput(values.dueTime)) errors.push('Проверьте время дела');
  }

  if (values.kind === 'assignment') {
    if (!values.assignee) errors.push('Выберите исполнителя поручения');
    if (!isValidTimeInput(values.dueTime)) errors.push('Проверьте срок поручения');
    if (values.points && Number(values.points) < 0) errors.push('Баллы не могут быть отрицательными');
  }

  return errors;
}

export function setComposerKind(values: ComposerFormValues, kind: ComposerKind): ComposerFormValues {
  if (kind === 'event') {
    return {
      ...values,
      kind,
      visibility: values.visibility === 'assignees' ? 'family' : values.visibility
    };
  }

  if (kind === 'task') {
    return {
      ...values,
      kind,
      visibility: values.visibility === 'assignees' ? 'private' : values.visibility
    };
  }

  return {
    ...values,
    kind,
    category: 'home',
    visibility: 'assignees',
    approvalRequired: true
  };
}

function createDateTimeIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
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

function createRecurrenceRule(repeat: ComposerRepeat): string | undefined {
  if (repeat === 'daily') return 'FREQ=DAILY';
  if (repeat === 'weekly') return 'FREQ=WEEKLY';
  if (repeat === 'monthly') return 'FREQ=MONTHLY';
  return undefined;
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
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

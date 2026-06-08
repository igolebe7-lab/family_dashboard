import { describe, expect, it } from 'vitest';

import { assignmentFormSchema, eventFormSchema } from './validation';

describe('composer validation schemas', () => {
  it('rejects events where endAt is earlier than startAt', () => {
    const result = eventFormSchema.safeParse({
      title: 'Врач',
      category: 'health',
      participants: ['mom'],
      startAt: '2026-05-15T10:30:00.000Z',
      endAt: '2026-05-15T09:30:00.000Z',
      allDay: false,
      visibility: 'assignees'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Окончание не может быть раньше начала');
  });

  it('rejects assignments without assignees', () => {
    const result = assignmentFormSchema.safeParse({
      title: 'Вынести мусор',
      createdBy: 'parent',
      assignees: [],
      dueAt: '2026-05-15T18:00:00.000Z',
      approvalRequired: true,
      category: 'home'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a single-assignee assignment to self', () => {
    const result = assignmentFormSchema.safeParse({
      title: 'Купить батарейки',
      createdBy: 'parent',
      assignees: ['parent'],
      dueAt: '2026-05-15T18:00:00.000Z',
      approvalRequired: false,
      category: 'shopping'
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Для задачи себе используйте тип «Дело»');
  });
});

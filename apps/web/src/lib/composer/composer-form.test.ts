import { describe, expect, it } from 'vitest';

import {
  createComposerFormValues,
  createComposerItemInput,
  setComposerKind,
  validateComposerForm
} from './composer-form';

describe('composer form', () => {
  it('blocks task submit without owner', () => {
    const values = setComposerKind(createComposerFormValues({ activeMemberId: 'member_mom' }), 'task');
    values.title = 'Вынести мусор';
    values.owner = '';

    expect(validateComposerForm(values)).toContain('Выберите, для кого задача');
  });

  it('blocks events where end time is earlier than start time', () => {
    const values = createComposerFormValues({ activeMemberId: 'member_mom', kind: 'event' });
    values.title = 'Врач';
    values.startTime = '14:00';
    values.endTime = '13:30';

    expect(validateComposerForm(values)).toContain('Окончание не может быть раньше начала');
  });

  it('normalizes task checklist and reminder into create item input', () => {
    const values = setComposerKind(createComposerFormValues({ activeMemberId: 'member_mom' }), 'task');
    values.title = 'Купить батарейки';
    values.owner = 'member_mom';
    values.date = '2026-06-11';
    values.dueTime = '18:30';
    values.category = 'shopping';
    values.checklistText = 'AA\nAAA';
    values.reminder = 'before_60';

    const result = createComposerItemInput(values, 'Europe/Amsterdam');

    expect(result).toMatchObject({
      ok: true,
      input: {
        kind: 'task',
        title: 'Купить батарейки',
        owner: 'member_mom',
        category: 'shopping',
        reminderOffsetMinutes: 60,
        checklist: [
          { id: 'check-1', title: 'AA', done: false },
          { id: 'check-2', title: 'AAA', done: false }
        ]
      }
    });
  });

  it('turns a task for another member into an assignment payload', () => {
    const values = setComposerKind(createComposerFormValues({ activeMemberId: 'member_mom' }), 'task');
    values.title = 'Вынести мусор';
    values.owner = 'member_child';
    values.date = '2026-06-11';
    values.dueTime = '18:30';
    values.approvalRequired = true;
    values.points = '5';

    const result = createComposerItemInput(values, 'Europe/Amsterdam');

    expect(result).toMatchObject({
      ok: true,
      input: {
        kind: 'assignment',
        title: 'Вынести мусор',
        assignees: ['member_child'],
        visibility: 'assignees',
        approvalRequired: true,
        points: 5
      }
    });
  });
});

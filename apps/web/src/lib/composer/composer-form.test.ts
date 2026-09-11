import { describe, expect, it } from 'vitest';

import {
  FAMILY_TARGET,
  createComposerFormValues,
  createComposerItemInput,
  setComposerKind,
  validateComposerForm
} from './composer-form';

describe('composer form', () => {
  const scheduled = () => ({ ...createComposerFormValues({ activeMemberId: 'm' }), title: 'Занятие', date: '2026-06-11' });

  it('serializes repeat presets and selected weekdays with bounded intervals', () => {
    for (const [repeat, rule] of [
      ['daily', 'FREQ=DAILY;INTERVAL=2'],
      ['weekdays', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR'],
      ['weekly', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TH'],
      ['monthly', 'FREQ=MONTHLY;INTERVAL=2']
    ] as const) {
      expect(createComposerItemInput({ ...scheduled(), repeat, repeatInterval: 2 }, 'Europe/Amsterdam'))
        .toMatchObject({ ok: true, input: { recurrenceRule: rule } });
    }
    expect(createComposerItemInput({ ...scheduled(), repeat: 'weekly', repeatDays: ['FR', 'MO', 'MO'] }, 'UTC'))
      .toMatchObject({ ok: true, input: { recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR' } });
  });

  it('requires custom weekdays and validates interval and inclusive end date', () => {
    expect(createComposerItemInput({ ...scheduled(), repeat: 'weekly', repeatDays: [] }, 'UTC').ok).toBe(false);
    for (const repeatInterval of [0, 53, 1.5, NaN]) {
      expect(createComposerItemInput({ ...scheduled(), repeat: 'daily', repeatInterval }, 'UTC').ok).toBe(false);
    }
    for (const repeatUntil of ['2026-06-10', '2026-02-30']) {
      expect(createComposerItemInput({ ...scheduled(), repeat: 'daily', repeatUntil }, 'UTC').ok).toBe(false);
    }
    expect(createComposerItemInput({ ...scheduled(), repeat: 'daily', repeatInterval: 52, repeatUntil: '2026-06-11' }, 'Europe/Amsterdam'))
      .toMatchObject({ ok: true, input: { recurrenceUntil: '2026-06-11T21:59:59.999Z' } });
    expect(createComposerItemInput({ ...scheduled(), repeat: 'none', repeatUntil: 'bad', repeatInterval: 0 }, 'UTC'))
      .toMatchObject({ ok: true, input: { recurrenceRule: undefined, recurrenceUntil: undefined } });
  });

  it('converts event and task wall-clock times in the passed family timezone', () => {
    expect(createComposerItemInput(scheduled(), 'Europe/Amsterdam'))
      .toMatchObject({ ok: true, input: { startAt: '2026-06-11T07:00:00.000Z', endAt: '2026-06-11T08:00:00.000Z' } });
    for (const owner of ['m', 'child', FAMILY_TARGET]) {
      expect(createComposerItemInput({ ...scheduled(), kind: 'task', owner }, 'Asia/Kathmandu'))
        .toMatchObject({ ok: true, input: { dueAt: '2026-06-11T12:15:00.000Z' } });
    }
    expect(createComposerItemInput({ ...scheduled(), allDay: true }, 'Europe/Amsterdam'))
      .toMatchObject({ ok: true, input: { startAt: '2026-06-10T22:00:00.000Z', endAt: '2026-06-11T21:59:00.000Z' } });
  });

  it('rejects DST gaps and invalid zones, choosing the earlier instant in a fold', () => {
    expect(createComposerItemInput({ ...scheduled(), date: '2026-03-29', startTime: '02:30', endTime: '04:00' }, 'Europe/Amsterdam').ok).toBe(false);
    expect(createComposerItemInput(scheduled(), 'Not/AZone').ok).toBe(false);
    expect(createComposerItemInput({ ...scheduled(), date: '2026-10-25', startTime: '02:30', endTime: '04:00' }, 'Europe/Amsterdam'))
      .toMatchObject({ ok: true, input: { startAt: '2026-10-25T00:30:00.000Z', endAt: '2026-10-25T03:00:00.000Z' } });
    expect(createComposerItemInput({ ...scheduled(), date: '2026-10-04', startTime: '02:15', endTime: '04:00' }, 'Australia/Lord_Howe').ok).toBe(false);
  });

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

  it('turns a family task into an assignment for every family member', () => {
    const values = setComposerKind(createComposerFormValues({ activeMemberId: 'member_mom' }), 'task');
    values.title = 'Собрать вещи';
    values.owner = FAMILY_TARGET;
    values.familyMemberIds = ['member_mom', 'member_child'];
    values.date = '2026-06-11';
    values.dueTime = '18:30';

    const result = createComposerItemInput(values, 'Europe/Amsterdam');

    expect(result).toMatchObject({
      ok: true,
      input: {
        kind: 'assignment',
        title: 'Собрать вещи',
        assignees: ['member_mom', 'member_child'],
        visibility: 'family'
      }
    });
  });

  it('expands family event participants to every family member', () => {
    const values = createComposerFormValues({ activeMemberId: 'member_mom', kind: 'event' });
    values.title = 'Обед';
    values.participants = [FAMILY_TARGET];
    values.familyMemberIds = ['member_mom', 'member_child'];

    const result = createComposerItemInput(values, 'Europe/Amsterdam');

    expect(result).toMatchObject({
      ok: true,
      input: {
        kind: 'event',
        participants: ['member_mom', 'member_child']
      }
    });
  });
});

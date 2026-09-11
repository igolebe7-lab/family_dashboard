import { describe, expect, it } from 'vitest';
import { createComposerFormValues } from './composer-form';
import { composerDraftKey, createComposerDraftStorage } from './composer-draft';

function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

describe('composer drafts', () => {
  const context = { familyId: 'f', memberId: 'm' };
  const defaults = createComposerFormValues({ activeMemberId: 'm' });

  it('restores old scoped drafts with recurrence defaults', () => {
    const store = storage();
    const { repeatInterval, repeatDays, repeatUntil, ...legacy } = defaults;
    store.setItem(composerDraftKey(context), JSON.stringify({ version: 1, values: { ...legacy, repeat: 'weekly', date: '2026-06-11' } }));
    expect(createComposerDraftStorage(() => store).restore(context, defaults))
      .toMatchObject({ repeat: 'weekly', repeatInterval: 1, repeatDays: undefined, repeatUntil: '' });
  });

  it('retains recurrence choices only in the matching family/member scope', () => {
    const store = storage();
    const drafts = createComposerDraftStorage(() => store);
    const values = { ...defaults, repeat: 'weekdays' as const, repeatInterval: 3, repeatDays: ['MO', 'FR'] as const, repeatUntil: '2026-12-31' };
    drafts.save(context, { ...values, repeatDays: [...values.repeatDays] });
    expect(drafts.restore(context, defaults)).toMatchObject(values);
    expect(drafts.restore({ ...context, familyId: 'other' }, defaults)).toBeNull();
    expect(drafts.restore({ ...context, memberId: 'other' }, defaults)).toBeNull();
  });

  it('retains a scoped draft and never reads another family or member draft', () => {
    const store = storage();
    const drafts = createComposerDraftStorage(() => store);
    expect(drafts.save(context, { ...defaults, title: 'Private draft' })).toBe(true);
    expect(drafts.restore(context, defaults)?.title).toBe('Private draft');
    expect(drafts.restore({ ...context, memberId: 'other' }, defaults)).toBeNull();
    expect(drafts.restore({ ...context, familyId: 'other' }, defaults)).toBeNull();
    drafts.remove(context);
    expect(drafts.restore(context, defaults)).toBeNull();
  });

  it('does not restore the legacy unscoped key', () => {
    const store = storage();
    store.setItem('familytime:composer:draft', JSON.stringify({ ...defaults, title: 'Someone else' }));
    expect(createComposerDraftStorage(() => store).restore(context, defaults)).toBeNull();
  });

  it('rejects malformed JSON, wrong field types and invalid enum values', () => {
    const store = storage();
    const drafts = createComposerDraftStorage(() => store);
    drafts.save(context, defaults);
    const key = [...store.data.keys()][0];
    for (const value of ['{', 'null', JSON.stringify({ version: 1, values: { ...defaults, participants: 3 } }), JSON.stringify({ version: 1, values: { ...defaults, kind: 'evil' } })]) {
      store.setItem(key, value);
      expect(drafts.restore(context, defaults)).toBeNull();
    }
  });

  it('handles unavailable storage and quota failures without breaking the form', () => {
    const drafts = createComposerDraftStorage(() => { throw new Error('denied'); });
    expect(drafts.restore(context, defaults)).toBeNull();
    expect(drafts.save(context, defaults)).toBe(false);
    expect(drafts.remove(context)).toBe(false);
  });
});

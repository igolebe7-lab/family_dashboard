import { describe, expect, it } from 'vitest';
import type { WorkLink } from '$lib/api/work-media.api';
import { mergeWorkLinkDraft, sameWorkLinks, workLinkDraftPatch } from './work-link-draft';

const first: WorkLink = { id: 'first', title: 'Инструкция', url: 'https://example.org/first' };
const second: WorkLink = { id: 'second', title: 'Новая ссылка', url: 'https://example.org/second' };
const local: WorkLink = { id: 'local', title: 'Моя ссылка', url: 'https://example.org/local' };

describe('work link draft merge', () => {
  it('adopts remote links while a photo-only draft keeps links unchanged', () => {
    const result = mergeWorkLinkDraft([first], [{ ...first }], [first, second]);
    expect(result.links).toEqual([first, second]);
    expect(result.baseLinks).toEqual([first, second]);
    expect(result.linksEdited).toBe(false);
    expect(result.conflict).toBe(false);
    expect(workLinkDraftPatch(result.baseLinks, result.links, result.conflict)).not.toHaveProperty('links');
  });
  it('adopts a remote removal without restoring the deleted link on photo save', () => {
    const result = mergeWorkLinkDraft([first, second], [first, second], [second]);
    expect(result.links).toEqual([second]);
    expect(workLinkDraftPatch(result.baseLinks, result.links, result.conflict)).toEqual({});
  });
  it('preserves locally edited links if the remote snapshot is unchanged', () => {
    const result = mergeWorkLinkDraft([first], [first, local], [{ ...first }]);
    expect(result.links).toEqual([first, local]);
    expect(result.baseLinks).toEqual([first]);
    expect(result.linksEdited).toBe(true);
    expect(result.conflict).toBe(false);
    expect(workLinkDraftPatch(result.baseLinks, result.links, result.conflict)).toEqual({ links: [first, local], expectedLinks: [first] });
  });
  it('blocks overwriting a remote link added concurrently with a local edit', () => {
    const result = mergeWorkLinkDraft([first], [first, local], [first, second]);
    expect(result.links).toEqual([first, local]);
    expect(result.baseLinks).toEqual([first]);
    expect(result.conflict).toBe(true);
    expect(() => workLinkDraftPatch(result.baseLinks, result.links, result.conflict)).toThrow('Ссылки изменились');
  });
  it('detects remote changes to title, URL and order, not only added IDs', () => {
    for (const remote of [[{ ...first, title: 'Изменено' }, second], [{ ...first, url: 'https://example.org/changed' }, second], [second, first]]) {
      expect(mergeWorkLinkDraft([first, second], [first], remote).conflict).toBe(true);
    }
  });
  it('keeps a conflict on repeated refresh until the draft is explicitly discarded', () => {
    const conflicted = mergeWorkLinkDraft([first], [local], [first, second]);
    const repeated = mergeWorkLinkDraft(conflicted.baseLinks, conflicted.links, [first, second], conflicted.conflict);
    expect(repeated.conflict).toBe(true);
    const discarded = mergeWorkLinkDraft([], [], [first, second]);
    expect(discarded.conflict).toBe(false);
    expect(discarded.linksEdited).toBe(false);
  });
  it('treats reverting local links as unchanged and preserves deliberate removal of all links', () => {
    expect(workLinkDraftPatch([first], [{ ...first }], false)).toEqual({});
    expect(workLinkDraftPatch([first], [], false)).toEqual({ links: [], expectedLinks: [first] });
  });
  it('compares semantic fields regardless of object property insertion order', () => {
    expect(sameWorkLinks([first], [{ url: first.url, title: first.title, id: first.id }])).toBe(true);
  });
  it('keeps the baseline isolated from mutable local edits', () => {
    const remote = [{ ...first }];
    const result = mergeWorkLinkDraft([], [], remote);
    result.links[0].title = 'Local edit';
    expect(result.baseLinks[0].title).toBe(first.title);
    expect(remote[0].title).toBe(first.title);
    expect(sameWorkLinks(result.baseLinks, result.links)).toBe(false);
  });
});

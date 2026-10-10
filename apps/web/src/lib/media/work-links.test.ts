import { describe, expect, it } from 'vitest';
import { normalizeWorkLink, validateWorkLinks, safeWorkLinkUrl, workLinkHost } from './work-links';
import { render } from 'svelte/server';
import WorkMediaDraft from '$lib/components/media/WorkMediaDraft.svelte';

describe('work links', () => {
  it('normalizes www and trims user input without fetching a website', () => {
    expect(normalizeWorkLink({ id: 'one', title: ' Инструкция ', url: ' www.example.org/guide ' }))
      .toEqual({ id: 'one', title: 'Инструкция', url: 'https://www.example.org/guide' });
  });
  it('uses the host as an optional title and preserves http links', () => {
    expect(normalizeWorkLink({ id: 'one', title: '', url: 'http://example.org' }).title).toBe('example.org');
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/file', '//evil.org', 'example.org', 'https://', 'https://user:password@example.org', 'https://example.org/\nscript'])('rejects unsafe or incomplete URLs: %s', url => {
    expect(() => normalizeWorkLink({ id: 'one', title: '', url })).toThrow();
    expect(safeWorkLinkUrl(url)).toBeNull();
  });
  it('enforces title, URL and list limits', () => {
    expect(() => normalizeWorkLink({ id: 'one', title: 'x'.repeat(121), url: 'https://example.org' })).toThrow();
    expect(() => normalizeWorkLink({ id: 'one', title: '', url: `https://example.org/${'x'.repeat(2048)}` })).toThrow();
    const links = Array.from({ length: 10 }, (_, index) => ({ id: String(index), title: 'Ссылка', url: 'https://example.org' }));
    expect(validateWorkLinks(links)).toHaveLength(10);
    expect(() => validateWorkLinks([...links, { ...links[0], id: 'extra' }])).toThrow();
    expect(() => validateWorkLinks([links[0], links[0]])).toThrow();
  });
  it('provides a safe host label without trusting HTML in a title', () => {
    expect(workLinkHost('https://www.example.org/path?q=one')).toBe('www.example.org');
    expect(workLinkHost('javascript:alert(1)')).toBe('');
    expect(normalizeWorkLink({ id: 'one', title: '<img onerror=alert(1)>', url: 'https://example.org' }).title).toBe('<img onerror=alert(1)>');
  });
});

describe('work link rendering', () => {
  it('escapes titles, safely labels long URLs, and opens links without opener access', () => {
    const { body } = render(WorkMediaDraft, { props: { editable: false, links: [{ id: 'one', title: '<img src=x onerror=alert(1)>', url: 'https://example.org/' + 'x'.repeat(300) }] } });
    expect(body).toContain('&lt;img');
    expect(body).not.toContain('<img src=x');
    expect(body).toContain('rel="noopener noreferrer"');
    expect(body).toContain('target="_blank"');
    expect(body).toContain('example.org');
    expect(body).not.toContain('Добавить ссылку');
    expect(body).not.toContain('Удалить ссылку');
  });
  it('does not create clickable unsafe links, even if supplied by the server', () => {
    const { body } = render(WorkMediaDraft, { props: { editable: false, links: [{ id: 'one', title: 'Unsafe', url: 'javascript:alert(1)' }] } });
    expect(body).not.toContain('href="javascript:');
    expect(body).toContain('Ссылка недоступна');
  });
});

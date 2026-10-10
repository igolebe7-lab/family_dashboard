import type { WorkLink } from '$lib/api/work-media.api';

export const WORK_LINK_MAX_COUNT = 10;
export const WORK_LINK_MAX_TITLE = 120;
export const WORK_LINK_MAX_URL = 2048;

export function safeWorkLinkUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed) || trimmed.includes('\\')) return null;
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  if (!/^https?:\/\//i.test(candidate) || candidate.length > WORK_LINK_MAX_URL) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href.length <= WORK_LINK_MAX_URL ? url.href : null;
  } catch { return null; }
}

export function workLinkHost(value: string): string {
  const url = safeWorkLinkUrl(value);
  return url ? new URL(url).host : '';
}

export function normalizeWorkLink(input: { id?: string; title: string; url: string }): WorkLink {
  const url = safeWorkLinkUrl(input.url);
  if (!url) throw new Error('Укажите полную ссылку http:// или https://.');
  const title = input.title.trim() || workLinkHost(url);
  if (title.length > WORK_LINK_MAX_TITLE) throw new Error('Название ссылки должно быть не длиннее 120 символов.');
  return { id: input.id || crypto.randomUUID(), title, url };
}

export function validateWorkLinks(links: readonly WorkLink[]): WorkLink[] {
  if (links.length > WORK_LINK_MAX_COUNT) throw new Error('К делу можно добавить не больше 10 ссылок.');
  const ids = new Set<string>();
  return links.map(link => {
    const normalized = normalizeWorkLink(link);
    if (ids.has(normalized.id)) throw new Error('Ссылки должны иметь разные идентификаторы.');
    ids.add(normalized.id);
    return normalized;
  });
}

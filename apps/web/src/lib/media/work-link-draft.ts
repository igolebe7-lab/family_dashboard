import type { WorkLink } from '$lib/api/work-media.api';
import { validateWorkLinks } from './work-links';

export function sameWorkLinks(left: readonly WorkLink[], right: readonly WorkLink[]): boolean {
  return left.length === right.length && left.every((link, index) => {
    const other = right[index];
    return link.id === other.id && link.title === other.title && link.url === other.url;
  });
}

function snapshot(links: readonly WorkLink[]): WorkLink[] { return links.map(link => ({ ...link })); }

export function mergeWorkLinkDraft(baseLinks: readonly WorkLink[], links: readonly WorkLink[], remoteLinks: readonly WorkLink[], conflict = false): {
  baseLinks: WorkLink[]; links: WorkLink[]; linksEdited: boolean; conflict: boolean;
} {
  const linksEdited = !sameWorkLinks(baseLinks, links);
  if (!linksEdited && !conflict) return { baseLinks: snapshot(remoteLinks), links: snapshot(remoteLinks), linksEdited: false, conflict: false };
  // Preserve the original baseline until save/discard, including across repeated SSE refreshes.
  return { baseLinks: snapshot(baseLinks), links: snapshot(links), linksEdited, conflict: conflict || !sameWorkLinks(baseLinks, remoteLinks) };
}

export function workLinkDraftPatch(baseLinks: readonly WorkLink[], links: readonly WorkLink[], conflict: boolean): { links?: WorkLink[]; expectedLinks?: WorkLink[] } {
  if (conflict) throw new Error('Ссылки изменились. Отмените изменения ссылок и загрузите актуальные.');
  if (sameWorkLinks(baseLinks, links)) return {};
  return { links: validateWorkLinks(links), expectedLinks: snapshot(baseLinks) };
}

<script lang="ts">
  import { onDestroy } from 'svelte';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import Link from '@lucide/svelte/icons/link';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import type { WorkLink, WorkMedia } from '$lib/api/work-media.api';
  import { COLLECTIONS } from '$lib/constants/collections';
  import { normalizeWorkLink, safeWorkLinkUrl, workLinkHost, WORK_LINK_MAX_COUNT } from '$lib/media/work-links';
  import { prepareWorkPhotos, WORK_PHOTO_MAX_COUNT } from '$lib/media/work-photo';
  import PhotoGallery, { type GalleryPhoto } from './PhotoGallery.svelte';

  export let photos: File[] = [];
  export let links: WorkLink[] = [];
  export let removePhotos: string[] = [];
  export let media: WorkMedia | null = null;
  export let editable = true;
  export let disabled = false;
  export let preparing = false;
  export let ready = true;
  let linkTitle = '', linkUrl = '', error = '';
  let picker: HTMLInputElement;
  let previews: GalleryPhoto[] = [], previewFiles: File[] | undefined;
  let version = 0;
  $: savedPhotos = media?.photos.filter(filename => !removePhotos.includes(filename)) ?? [];
  $: totalPhotos = savedPhotos.length + photos.length;
  $: if (photos !== previewFiles) updatePreviews(photos);
  $: gallery = [
    ...savedPhotos.map((filename, index) => ({ key: `saved:${filename}`, collection: COLLECTIONS.workMedia, id: media!.id, filename, alt: `Фото дела ${index + 1}` })),
    ...previews
  ];
  $: ready = !preparing && !linkTitle.trim() && !linkUrl.trim();
  $: if (!editable) { version++; preparing = false; linkTitle = ''; linkUrl = ''; error = ''; }

  function updatePreviews(files: File[]) {
    previews.forEach(photo => { if (photo.src) URL.revokeObjectURL(photo.src); });
    previewFiles = files;
    previews = typeof window === 'undefined' ? [] : files.map((file, index) => ({ key: `draft-${index}`, src: URL.createObjectURL(file), alt: file.name }));
  }
  async function addPhotos(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []); input.value = '';
    if (!files.length || disabled || !editable || preparing) return;
    const current = ++version; preparing = true; error = '';
    try {
      const prepared = await prepareWorkPhotos(files, totalPhotos);
      if (current === version && editable) photos = [...photos, ...prepared];
    } catch (cause) { if (current === version) error = cause instanceof Error ? cause.message : 'Не удалось подготовить фото. Попробуйте ещё раз.'; }
    finally { if (current === version) preparing = false; }
  }
  function removePhoto(key: string) {
    if (!editable || disabled || preparing) return;
    if (key.startsWith('draft-')) photos = photos.filter((_, index) => `draft-${index}` !== key);
    else removePhotos = [...removePhotos, key.slice('saved:'.length)];
  }
  function addLink() {
    if (!editable || disabled || preparing) return;
    error = '';
    try {
      if (links.length >= WORK_LINK_MAX_COUNT) throw new Error('К делу можно добавить не больше 10 ссылок.');
      links = [...links, normalizeWorkLink({ title: linkTitle, url: linkUrl })];
      linkTitle = ''; linkUrl = '';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Проверьте ссылку.'; }
  }
  function linkKey(event: KeyboardEvent) { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); addLink(); } }
  onDestroy(() => { version++; previews.forEach(photo => { if (photo.src) URL.revokeObjectURL(photo.src); }); });
</script>

<div class="work-media-draft" aria-busy={preparing}>
  <div class="media-heading"><h3>Фото <small>{totalPhotos} / {WORK_PHOTO_MAX_COUNT}</small></h3>
    {#if editable}<button type="button" class="media-icon" disabled={disabled || preparing || totalPhotos >= WORK_PHOTO_MAX_COUNT} aria-label="Добавить фотографии" title="Добавить фотографии" on:click={() => picker.click()}><ImagePlus size={20} aria-hidden="true" /></button><input class="photo-input" bind:this={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple tabindex="-1" aria-label="Фотографии дела" disabled={disabled || preparing} on:change={addPhotos} />{/if}
  </div>
  <PhotoGallery photos={gallery} onremove={editable ? removePhoto : undefined} disabled={disabled || preparing} />
  {#if preparing}<p class="media-note" role="status">Подготавливаем фотографии…</p>{/if}
  <div class="media-heading"><h3>Ссылки <small>{links.length} / {WORK_LINK_MAX_COUNT}</small></h3><Link size={18} aria-hidden="true" /></div>
  {#if links.length}<ul class="work-links">
    {#each links as link (link.id)}
      {@const url = safeWorkLinkUrl(link.url)}
      <li>
        {#if url}<a href={url} target="_blank" rel="noopener noreferrer"><span><strong>{link.title || workLinkHost(url)}</strong><small>{workLinkHost(url)}</small></span><ExternalLink size={17} aria-hidden="true" /></a>{:else}<span class="media-note">Ссылка недоступна</span>{/if}
        {#if editable}<button type="button" class="media-icon" disabled={disabled || preparing} aria-label={`Удалить ссылку ${link.title}`} title="Удалить ссылку" on:click={() => links = links.filter(row => row.id !== link.id)}><Trash2 size={17} aria-hidden="true" /></button>{/if}
      </li>
    {/each}
  </ul>{/if}
  {#if editable && links.length < WORK_LINK_MAX_COUNT}
    <div class="link-fields">
      <label>Название ссылки<input bind:value={linkTitle} maxlength="120" placeholder="Необязательно" disabled={disabled || preparing} on:keydown={linkKey} /></label>
      <label>Адрес ссылки<input bind:value={linkUrl} type="text" inputmode="url" maxlength="2048" placeholder="https:// или www." disabled={disabled || preparing} on:keydown={linkKey} /></label>
      <div class="link-actions"><button type="button" class="button button--soft" disabled={disabled || preparing || !linkUrl.trim()} on:click={addLink}><Plus size={18} aria-hidden="true" />Добавить ссылку</button>{#if linkTitle || linkUrl}<button type="button" class="button button--ghost" disabled={disabled || preparing} on:click={() => { linkTitle = ''; linkUrl = ''; error = ''; }}>Отмена</button>{/if}</div>
    </div>
  {/if}
  {#if error}<p class="page-error" role="alert">{error}</p>{/if}
</div>

<style>
  .work-media-draft { display: grid; gap: 10px; min-width: 0; }
  .media-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
  h3 { margin: 0; font-size: 15px; }
  h3 small { margin-left: 8px; color: var(--color-text-muted); font-size: 12px; font-weight: 400; }
  .media-icon { display: inline-grid; place-items: center; width: 44px; height: 44px; flex: 0 0 44px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--material-control, var(--color-surface)); color: var(--color-text); cursor: pointer; }
  .photo-input { display: none; }
  .media-note { margin: 0; color: var(--color-text-muted); font-size: 13px; overflow-wrap: anywhere; }
  .work-links { display: grid; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .work-links li { display: flex; align-items: center; gap: 8px; min-width: 0; }
  a { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; min-height: 44px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--material-control, var(--color-surface)); color: var(--color-text); text-decoration: none; }
  a span { min-width: 0; overflow-wrap: anywhere; }
  a strong { font-size: 14px; font-weight: 500; }
  a small { display: block; margin-top: 3px; color: var(--color-text-muted); font-size: 12px; }
  a :global(svg) { flex-shrink: 0; }
  .link-fields { display: grid; gap: 8px; min-width: 0; }
  label { display: grid; gap: 6px; font-size: 13px; min-width: 0; }
  input { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; border: 1px solid var(--color-border); border-radius: 8px; padding: 10px; background: var(--material-control, var(--color-surface)); color: var(--color-text); font: inherit; font-size: 16px; }
  .link-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .link-actions .button { min-width: 0; font-size: 13px; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--color-green); outline-offset: 2px; }
  button:disabled { opacity: 0.5; cursor: default; }
</style>

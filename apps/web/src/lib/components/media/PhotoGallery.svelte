<script context="module" lang="ts">
  export type GalleryPhoto = { key: string; alt: string; src?: string; collection?: string; id?: string; filename?: string };
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ProtectedImage from './ProtectedImage.svelte';
  import { getDialogTabStops } from '$lib/composer/modal-focus';

  export let photos: GalleryPhoto[] = [];
  export let onremove: ((key: string) => void) | undefined = undefined;
  export let disabled = false;
  let activeKey: string | null = null;
  let opener: HTMLElement | null = null;
  $: index = photos.findIndex(photo => photo.key === activeKey);
  $: active = photos[index];
  $: if (activeKey && index < 0) close();

  function open(photo: GalleryPhoto, target: HTMLElement) { opener = target; activeKey = photo.key; }
  function close() {
    activeKey = null;
    const target = opener; opener = null;
    void tick().then(() => { if (target?.isConnected) target.focus({ preventScroll: true }); });
  }
  function move(direction: number) { activeKey = photos[(index + direction + photos.length) % photos.length]?.key ?? null; }

  function focusGallery(node: HTMLElement) {
    // Keep the gallery inside its parent's top layer, without another native dialog or body lock.
    const parentDialog = node.closest('dialog');
    const parentStyles = parentDialog ? ['backdrop-filter', '-webkit-backdrop-filter', 'transform', 'filter', 'perspective', 'contain', 'will-change'].map(property => ({ property, value: parentDialog.style.getPropertyValue(property), priority: parentDialog.style.getPropertyPriority(property) })) : [];
    // A filtered native dialog is itself a fixed containing block (notably mobile WebKit).
    if (parentDialog) parentStyles.forEach(({ property }) => parentDialog.style.setProperty(property, property === 'will-change' ? 'auto' : 'none', 'important'));
    // Portalling past glass/transform wrappers gives fixed positioning a viewport-sized containing block.
    (parentDialog ?? document.body).appendChild(node);
    let restoreScroll: (() => void) | undefined;
    if (!parentDialog && document.body.style.position !== 'fixed') {
      const { scrollX, scrollY } = window;
      const body = document.body.style, root = document.documentElement.style;
      const previousBody = { position: body.position, top: body.top, left: body.left, width: body.width, overflow: body.overflow, overscrollBehavior: body.overscrollBehavior };
      const previousRoot = { overflow: root.overflow, overscrollBehavior: root.overscrollBehavior };
      Object.assign(body, { position: 'fixed', top: `${-scrollY}px`, left: `${-scrollX}px`, width: '100%', overflow: 'hidden', overscrollBehavior: 'none' });
      Object.assign(root, { overflow: 'hidden', overscrollBehavior: 'none' });
      restoreScroll = () => { Object.assign(body, previousBody); Object.assign(root, previousRoot); window.scrollTo(scrollX, scrollY); };
    }
    const inert: { element: HTMLElement; previous: boolean }[] = [];
    for (let current: HTMLElement | null = node; current && current !== parentDialog && current.parentElement; current = current.parentElement) {
      for (const sibling of current.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== current) {
          inert.push({ element: sibling, previous: sibling.inert }); sibling.inert = true;
        }
      }
      if (current.parentElement === document.body) break;
    }
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowLeft' ? -1 : 1); }
      else if (event.key === 'Tab') {
        const controls = getDialogTabStops(node as HTMLDialogElement);
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); node.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        event.stopPropagation();
      }
    };
    const cancel = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); close(); };
    document.addEventListener('keydown', keys, true);
    parentDialog?.addEventListener('cancel', cancel, true);
    node.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return { destroy() {
      document.removeEventListener('keydown', keys, true);
      parentDialog?.removeEventListener('cancel', cancel, true);
      inert.forEach(({ element, previous }) => element.inert = previous);
      parentStyles.forEach(({ property, value, priority }) => { if (value) parentDialog!.style.setProperty(property, value, priority); else parentDialog!.style.removeProperty(property); });
      restoreScroll?.();
      node.remove();
    } };
  }
  onDestroy(() => { if (activeKey) close(); });
</script>

{#if photos.length}
  <div class="photo-grid" aria-label="Фотографии дела">
    {#each photos as photo, position (photo.key)}
      <div class="photo-tile">
        <button class="photo-open" type="button" aria-label={`Открыть фото ${position + 1}`} on:click={event => open(photo, event.currentTarget)}>
          {#if photo.src}<img src={photo.src} alt={photo.alt} />
          {:else if photo.collection && photo.id && photo.filename}<ProtectedImage collection={photo.collection} id={photo.id} filename={photo.filename} alt={photo.alt} thumb="320x320" className="work-photo-thumb" />{/if}
        </button>
        {#if onremove}<button class="photo-remove" type="button" {disabled} aria-label={`Удалить фото ${position + 1}`} title="Удалить фото" on:click={() => onremove?.(photo.key)}><Trash2 size={17} aria-hidden="true" /></button>{/if}
      </div>
    {/each}
  </div>
{/if}

{#if active}
  <div class="photo-viewer" role="dialog" aria-modal="true" aria-label="Просмотр фотографий дела" tabindex="-1" use:focusGallery>
    <header><span role="status" aria-live="polite">Фото {index + 1} из {photos.length}</span><button type="button" class="gallery-icon" aria-label="Закрыть фото" title="Закрыть фото" on:click={close}><X size={22} aria-hidden="true" /></button></header>
    <div class="photo-viewer__image">
      {#key active.key}
        {#if active.src}<img src={active.src} alt={active.alt} />
        {:else if active.collection && active.id && active.filename}<ProtectedImage collection={active.collection} id={active.id} filename={active.filename} alt={active.alt} className="work-photo-full" />{/if}
      {/key}
    </div>
    <footer>
      <button type="button" class="gallery-icon" disabled={photos.length < 2} aria-label="Предыдущее фото" title="Предыдущее фото" on:click={() => move(-1)}><ChevronLeft size={24} aria-hidden="true" /></button>
      <span>{index + 1} / {photos.length}</span>
      <button type="button" class="gallery-icon" disabled={photos.length < 2} aria-label="Следующее фото" title="Следующее фото" on:click={() => move(1)}><ChevronRight size={24} aria-hidden="true" /></button>
    </footer>
  </div>
{/if}

<style>
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 8px; min-width: 0; }
  .photo-tile { display: grid; align-content: start; gap: 4px; min-width: 0; }
  .photo-open { display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); overflow: hidden; cursor: pointer; }
  .photo-open img, .photo-open :global(.work-photo-thumb) { display: block; width: 100%; height: 100%; object-fit: cover; }
  .photo-remove, .gallery-icon { display: inline-grid; place-items: center; min-width: 44px; min-height: 44px; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--material-control, var(--color-surface)); color: var(--color-text); cursor: pointer; }
  .photo-remove { justify-self: end; }
  button:focus-visible { outline: 2px solid var(--color-green); outline-offset: 2px; }
  button:disabled { opacity: 0.5; cursor: default; }
  .photo-viewer { position: fixed; inset: 0; z-index: 100; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); background: var(--color-surface); color: var(--color-text); backdrop-filter: blur(20px); overscroll-behavior: contain; }
  header, footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; }
  footer { justify-content: center; }
  .photo-viewer__image { min-height: 0; min-width: 0; display: grid; place-items: center; padding-block: 12px; overflow: hidden; }
  .photo-viewer__image img, .photo-viewer__image :global(.work-photo-full) { display: block; max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
  .photo-viewer__image :global(.work-photo-full img) { object-fit: contain; }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { getIcon } from '$lib/design/icon-registry';
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import { openComposerDialog } from '$lib/composer/modal-focus';
  import { itemDetailsStore } from '$lib/stores/item-details.store';
  import type { TodayMonthDay } from '$lib/today/today-month-calendar';
  export let day: TodayMonthDay;
  export let anchor: HTMLElement;
  export let touch = false;
  export let focusOnOpen = false;
  export let loading = false;
  export let error = '';
  export let onretry: (() => void) | undefined = undefined;
  export let onannotations: (() => void) | undefined = undefined;
  export let onclose: () => void;
  export let onenter: () => void;
  export let onleave: () => void;
  let dialog: HTMLDialogElement;
  $: label = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date(`${day.dateKey}T12:00:00`));
  function openItem(id?: string) {
    if (!id) return;
    onclose();
    itemDetailsStore.set(id);
  }
  onMount(() => {
    if (touch) return openComposerDialog(dialog, onclose);
    const previous = document.activeElement;
    dialog.show();
    if (!focusOnOpen && previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    function position() {
      const rect = anchor.getBoundingClientRect();
      const box = dialog.getBoundingClientRect();
      dialog.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
      dialog.style.top = `${Math.max(12, Math.min(rect.bottom + 6, innerHeight - box.height - 12))}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(dialog);
    return () => {
      observer.disconnect();
      const restore = dialog.contains(document.activeElement);
      dialog.close();
      if ((focusOnOpen || restore) && anchor.isConnected) anchor.focus({ preventScroll: true });
    };
  });
  function dismiss(event: Event) { event.preventDefault(); onclose(); }
</script>
<svelte:window on:resize={onclose} on:pointerdown={(event) => { if (!touch && event.target instanceof Node && !dialog.contains(event.target) && !anchor.contains(event.target)) onclose(); }} on:keydown={(event) => { if (event.key === 'Escape') onclose(); }} />
<dialog bind:this={dialog} class:day-preview--touch={touch} class="day-preview" aria-label={`События: ${label}`} on:cancel={dismiss} on:pointerenter={onenter} on:pointerleave={onleave}>
  <header><strong>{label}</strong><button class="icon-button" aria-label="Закрыть сводку дня" on:click={onclose}><X size={20} /></button></header>
  <div class="day-preview__list">
    {#if loading}<p role="status">Загружаем события…</p>{/if}
    {#if error}<p role="alert">{error}</p><button class="button" on:click={onretry}>Повторить</button>{/if}
    {#each day.events as event (event.id)}
      {@const Icon = getIcon(event.icon)}
      <button class="day-preview__event" disabled={!event.itemId} on:click={() => openItem(event.itemId)}>
        <time>{event.allDay ? 'Весь день' : event.start}</time><span class="day-preview__event-icon" style={`--event-tone: var(--color-${event.color})`} aria-hidden="true"><Icon size={18} /></span><span><strong>{event.title}</strong><small>{event.memberName}</small></span><ChevronRight size={16} aria-hidden="true" />
      </button>
    {:else}{#if !loading && !error}<p>Нет событий</p>{/if}{/each}
    {#each day.annotations as annotation (annotation.id)}<p class="day-preview__annotation">{annotation.title}</p>{/each}
  </div>
  {#if onannotations}<button class="button button--ghost" on:click={onannotations}>Особые даты</button>{/if}
  <a class="button button--soft" href={buildTodayCalendarHref({ dateKey: day.dateKey, view: 'day' })} on:click={onclose}>Открыть день<ArrowRight size={18} /></a>
</dialog>
<style>
  .day-preview { position: fixed; margin: 0; width: min(360px, calc(100vw - 24px)); max-width: none; max-height: min(460px, calc(100dvh - 24px)); padding: 16px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); box-shadow: 0 8px 30px rgb(0 0 0 / 16%); z-index: 80; }
  .day-preview[open] { display: flex; flex-direction: column; gap: 12px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
  header > strong { font-size: 16px; }
  .day-preview__list { overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
  .day-preview__event { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 12px; width: 100%; padding: 12px 0; min-height: 48px; text-align: left; border: 0; border-bottom: 1px solid var(--color-border); background: transparent; color: inherit; cursor: pointer; }
  @media (min-width: 1024px) { .day-preview__event { grid-template-columns: 46px minmax(0, 1fr); } .day-preview__event-icon, .day-preview__event :global(> svg) { display: none; } }
  @media (hover: hover) { .day-preview__event:hover { background: var(--color-green-soft); } }
  .day-preview__event:focus-visible { background: var(--color-green-soft); }
  .day-preview__event strong { font-size: 14px; overflow-wrap: anywhere; }
  small { display: block; color: var(--color-text-muted); margin-top: 4px; }
  time { font-size: 13px; }
  .day-preview__annotation { color: var(--color-text-muted); font-size: 13px; }
  .day-preview > a { flex-shrink: 0; }
  .day-preview--touch { inset: auto 12px max(12px, env(safe-area-inset-bottom)); width: auto; max-height: 70dvh; }
  .day-preview::backdrop { background: rgb(0 0 0 / 30%); }
</style>

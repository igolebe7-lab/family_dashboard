<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { TodayAttentionItem } from '$lib/today/today-view-model';
  import TodayEmptyState from './TodayEmptyState.svelte';

  export let items: TodayAttentionItem[] = [];
  export let labelledBy = 'attention-title';
  export let title = 'Нужно внимание';
  export let emptyTitle = 'Ничего срочного';
  export let emptyBody = 'Когда появятся поручения на проверку или важные записи, они будут здесь.';
  export let resetKey = '';
  let expanded = false;
  $: resetExpansion(resetKey);
  function resetExpansion(_key: string) { expanded = false; }
  $: visibleItems = expanded ? items : items.slice(0, 5);
  export let busyItemId: string | null = null;
  export let onapprove: ((item: TodayAttentionItem) => void | Promise<void>) | undefined = undefined;
  export let onreject: ((item: TodayAttentionItem) => void | Promise<void>) | undefined = undefined;
  export let onopen: ((item: TodayAttentionItem) => void | Promise<void>) | undefined = undefined;
</script>

<section class="today-attention" aria-labelledby={labelledBy}>
  <div class="section-title-row">
    <h2 id={labelledBy}>{title}</h2>
  </div>

  {#if items.length === 0}
    <TodayEmptyState
      title={emptyTitle}
      body={emptyBody}
    />
  {:else}
    <div class="today-attention__list">
      {#each visibleItems as item (item.id)}
        <article class={`today-attention-card today-attention-card--${item.color}`}>
          <span class={`today-attention-card__avatar portrait portrait--${item.memberPortrait}`} aria-hidden="true">
            <span class="portrait__face">{item.memberInitial}</span>
          </span>
          <div class="today-attention-card__copy">
            {#if item.itemId}<button class="attention-open" type="button" on:click={() => onopen?.(item)}>{item.body}</button>{:else}<p>{item.body}</p>{/if}
          </div>
          {#if item.actionKind === 'approve_assignment'}
            <div class="today-attention-card__actions">
              <button
                class="today-attention-card__action today-attention-card__action--primary"
                type="button"
                disabled={busyItemId === item.id}
                on:click={() => onapprove?.(item)}
              >
                {busyItemId === item.id ? '...' : item.actionLabel}
              </button>
              <button
                class="today-attention-card__action"
                type="button"
                disabled={busyItemId === item.id}
                on:click={() => onreject?.(item)}
              >
                {item.secondaryActionLabel ?? 'Вернуть'}
              </button>
            </div>
          {:else}
            <button
              class="today-attention-card__icon-button"
              type="button"
              aria-label={item.actionLabel}
              on:click={() => onopen?.(item)}
            >
              <ChevronRight size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          {/if}
        </article>
      {/each}
    </div>
    {#if items.length > 5}<button class="button button--ghost" type="button" aria-expanded={expanded} on:click={() => expanded = !expanded}>{expanded ? 'Свернуть' : `Показать все (${items.length})`}</button>{/if}
  {/if}
</section>

<style>
  .today-attention-card { position: relative; }
  .attention-open { border: 0; background: transparent; color: inherit; text-align: left; font: inherit; font-weight: 600; padding: 0; cursor: pointer; }
  .attention-open::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
  .attention-open:focus-visible::after { outline: 2px solid var(--color-green); outline-offset: 2px; }
  .today-attention-card__actions, .today-attention-card__icon-button { position: relative; z-index: 1; }
</style>

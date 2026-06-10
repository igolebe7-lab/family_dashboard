<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { TodayAttentionItem } from '$lib/today/today-view-model';
  import TodayEmptyState from './TodayEmptyState.svelte';

  export let items: TodayAttentionItem[] = [];
  export let labelledBy = 'attention-title';
</script>

<section class="today-attention" aria-labelledby={labelledBy}>
  <div class="section-title-row">
    <h2 id={labelledBy}>Нужно внимание</h2>
  </div>

  {#if items.length === 0}
    <TodayEmptyState
      title="Ничего срочного"
      body="Когда появятся поручения на проверку или напоминания, они будут здесь."
    />
  {:else}
    <div class="today-attention__list">
      {#each items as item (item.id)}
        <article class={`today-attention-card today-attention-card--${item.color}`}>
          <span class={`today-attention-card__avatar portrait portrait--${item.memberPortrait}`} aria-hidden="true">
            <span class="portrait__face">{item.memberInitial}</span>
          </span>
          <div class="today-attention-card__copy">
            <p>{item.body}</p>
          </div>
          <button type="button" aria-label={item.actionLabel}>
            <ChevronRight size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </article>
      {/each}
    </div>
  {/if}
</section>

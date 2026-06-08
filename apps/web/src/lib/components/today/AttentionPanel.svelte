<script lang="ts">
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import type { TodayAttentionItem } from '$lib/today/today-view-model';

  export let items: TodayAttentionItem[] = [];
  export let labelledBy = 'attention-title';
</script>

<section class="today-attention" aria-labelledby={labelledBy}>
  <div class="section-title-row">
    <div>
      <p class="section-kicker">Мягкие напоминания</p>
      <h2 id={labelledBy}>Нужно внимание</h2>
    </div>
    <CircleAlert size={21} strokeWidth={2.2} aria-hidden="true" />
  </div>

  <div class="today-attention__list">
    {#each items as item (item.id)}
      <article class={`today-attention-card today-attention-card--${item.color}`}>
        <span class="today-attention-card__avatar" aria-hidden="true">{item.memberInitial}</span>
        <div>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </div>
        <button type="button">{item.actionLabel}</button>
      </article>
    {/each}
  </div>
</section>

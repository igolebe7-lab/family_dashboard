<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import type { TodayQuickAction } from '$lib/today/today-view-model';

  export let actions: TodayQuickAction[] = [];
  export let labelledBy = 'quick-actions-title';
</script>

<section class="today-quick-actions" aria-labelledby={labelledBy}>
  <div class="section-title-row">
    <h2 id={labelledBy}>Быстрые действия</h2>
  </div>

  <div class="today-quick-actions__grid">
    {#each actions as action (action.id)}
      <button class={`today-quick-action today-quick-action--${action.color}`} type="button">
        <span aria-hidden="true">
          <Plus size={29} strokeWidth={2.45} />
        </span>
        {action.label}
      </button>
    {/each}
  </div>
</section>

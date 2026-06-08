<script lang="ts">
  import { getIcon } from '$lib/design/icon-registry';
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
      {@const Icon = getIcon(action.icon)}
      <button class={`today-quick-action today-quick-action--${action.color}`} type="button">
        <span aria-hidden="true">
          <svelte:component this={Icon} size={20} strokeWidth={2.35} />
        </span>
        {action.label}
      </button>
    {/each}
  </div>
</section>

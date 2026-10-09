<script lang="ts">
  import Star from '@lucide/svelte/icons/star';
  import { pointsStore, refreshPoints } from '$lib/stores/points.store';
  import { familyStore } from '$lib/stores/family.store';
  export let memberId: string;
  $: member = $familyStore.members.find(member => member.id === memberId && member.active && ['child', 'teen'].includes(member.role));
  $: balance = $pointsStore.balances[memberId];
</script>
{#if member}
  <section class="child-points" aria-label={`Баланс ${member.displayName}`}>
    <Star size={22} aria-hidden="true" /><div><span>Баланс · {member.displayName}</span>
      {#if $pointsStore.loading && balance === undefined}<p role="status">Обновляем…</p>
      {:else if $pointsStore.error}<p role="alert">{$pointsStore.error}</p><button class="button button--soft" on:click={() => refreshPoints()}>Повторить</button>
      {:else if balance !== undefined}<strong>{balance} баллов</strong>{/if}
    </div>
  </section>
{/if}
<style>
  .child-points { display: flex; align-items: center; gap: 12px; padding-block: 20px; min-width: 0; }
  .child-points :global(svg) { color: var(--color-yellow); flex-shrink: 0; }
  .child-points > div { display: grid; gap: 6px; min-width: 0; }
  span { color: var(--color-text-muted); font-size: 13px; }
  strong { font-size: 22px; }
  p { margin: 0; overflow-wrap: anywhere; }
</style>

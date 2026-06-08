<script lang="ts">
  import type { AccentColor } from '$lib/constants/colors';

  export let name: string;
  export let initial: string;
  export let color: AccentColor;
  export let roleLabel = '';
  export let todayCount: number | undefined = undefined;
  export let selected = false;
</script>

<button
  class:member-avatar-card--selected={selected}
  class={`member-avatar-card member-avatar-card--${color}`}
  type="button"
  aria-label={`${name}${todayCount ? `, дел сегодня: ${todayCount}` : ''}`}
>
  <span class="member-avatar-card__halo" aria-hidden="true">
    <span>{initial}</span>
  </span>
  <span class="member-avatar-card__name">{name}</span>
  {#if roleLabel}
    <span class="member-avatar-card__role">{roleLabel}</span>
  {/if}
  {#if todayCount !== undefined}
    <span class="member-avatar-card__count">{todayCount}</span>
  {/if}
</button>

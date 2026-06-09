<script lang="ts">
  import type { AccentColor } from '$lib/constants/colors';

  export let name: string;
  export let initial: string;
  export let color: AccentColor;
  export let portrait: 'mom' | 'dad' | 'misha' | 'anya';
  export let roleLabel = '';
  export let todayCount: number | undefined = undefined;
  export let selected = false;
</script>

<button
  class:member-avatar-card--selected={selected}
  class={`member-avatar-card member-avatar-card--${color}`}
  type="button"
  aria-label={`${name}${roleLabel ? `, ${roleLabel}` : ''}${todayCount ? `, дел сегодня: ${todayCount}` : ''}`}
>
  <span class={`member-avatar-card__halo portrait portrait--${portrait}`} aria-hidden="true">
    <span class="portrait__face">{initial}</span>
  </span>
  <span class="member-avatar-card__label">
    <span class="member-avatar-card__dot" aria-hidden="true"></span>
    <span class="member-avatar-card__name">{name}</span>
  </span>
</button>

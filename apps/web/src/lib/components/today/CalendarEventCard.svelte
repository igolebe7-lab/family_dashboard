<script lang="ts">
  import { getIcon } from '$lib/design/icon-registry';
  import type { TodayWeekEvent } from '$lib/today/today-view-model';

  export let event: TodayWeekEvent;
  export let positionStyle = '';

  $: Icon = getIcon(event.icon);
  $: compact = Boolean(positionStyle) && event.durationMinutes < 90;
  $: tiny = Boolean(positionStyle) && event.durationMinutes < 45;
</script>

<svelte:element this={event.itemId ? 'a' : 'article'}
  href={event.itemId ? `/app/items/${encodeURIComponent(event.itemId)}` : undefined}
  class={`calendar-event-card event-${event.color}${compact ? ' calendar-event-card--compact' : ''}${tiny ? ' calendar-event-card--tiny' : ''}`}
  style={positionStyle}
  aria-label={`${event.title}, ${event.start}, ${event.memberName}`}
>
  <div class="calendar-event-card__top">
    <span class="calendar-event-card__icon" aria-hidden="true">
      <svelte:component this={Icon} size={15} strokeWidth={2.35} />
    </span>
    <strong>{event.title}</strong>
  </div>

  <span class="calendar-event-card__meta">
    <time>{event.start}</time>
    {#if !compact}<span>{event.memberName}</span>{/if}
  </span>

  {#if !compact}<span class={`calendar-event-card__avatar portrait portrait--${event.memberPortrait}`} aria-hidden="true">
    <span class="portrait__face">{event.memberInitial}</span>
  </span>{/if}
</svelte:element>

<style>
  .calendar-event-card { display: flex; flex-direction: column; gap: 4px; overflow: hidden; min-width: 0; padding: 8px; }
  .calendar-event-card__top { flex: 0 0 auto; align-items: start; min-width: 0; gap: 4px; }
  .calendar-event-card__icon { flex: 0 0 15px; }
  .calendar-event-card strong { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; font-size: 12px; line-height: 15px; margin: 0; }
  .calendar-event-card__meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 0 0 auto; margin: 0; }
  .calendar-event-card__meta time, .calendar-event-card__meta span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; line-height: 14px; }
  .calendar-event-card__avatar { position: static; flex: 0 0 24px; width: 24px; height: 24px; margin: 0; }
  .calendar-event-card--compact { gap: 3px; padding: 6px; }
  .calendar-event-card--tiny strong { -webkit-line-clamp: 1; line-clamp: 1; }
</style>

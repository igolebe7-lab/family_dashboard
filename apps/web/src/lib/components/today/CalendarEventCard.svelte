<script lang="ts">
  import { getIcon } from '$lib/design/icon-registry';
  import type { TodayWeekEvent } from '$lib/today/today-view-model';

  export let event: TodayWeekEvent;
  export let positionStyle = '';

  $: Icon = getIcon(event.icon);
</script>

<article
  class={`calendar-event-card event-${event.color}`}
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
    <span>{event.memberName}</span>
  </span>

  <span class={`calendar-event-card__avatar portrait portrait--${event.memberPortrait}`} aria-hidden="true">
    <span class="portrait__face">{event.memberInitial}</span>
  </span>
</article>

<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import X from '@lucide/svelte/icons/x';
  import { createDayDetailViewModel } from '$lib/calendar/day-detail';
  import type { YearCalendarDay } from '$lib/calendar/year-calendar';

  export let day: YearCalendarDay | undefined = undefined;
  export let onclose: (() => void) | undefined = undefined;
  export let titleId = 'day-detail-title';
  export let todayHref: string | undefined = undefined;

  $: model = day ? createDayDetailViewModel(day) : undefined;
</script>

{#if model}
  <aside class="day-detail-sheet" aria-labelledby={titleId}>
    <header class="day-detail-sheet__header">
      <div>
        <h2 id={titleId}>{model.title}</h2>
        <p>{model.subtitle}</p>
      </div>
      <button type="button" aria-label="Закрыть детали дня" on:click={() => onclose?.()}>
        <X size={19} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </header>

    {#if model.items.length === 0}
      <p class="day-detail-sheet__empty">В этот день нет праздников, дней рождения или особых дат.</p>
    {:else}
      <div class="day-detail-sheet__list">
        {#each model.items as item (item.id)}
          <article class={`day-detail-item day-detail-item--${item.color}`}>
            <span class={`year-marker year-marker--${item.kind} year-marker--${item.color}`} aria-hidden="true"></span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.meta}</p>
            </div>
            {#if item.readonly}
              <span class="day-detail-item__badge">системное</span>
            {/if}
          </article>
        {/each}
      </div>
    {/if}

    {#if todayHref}
      <a class="day-detail-sheet__today-link" href={todayHref}>
        Открыть в Сегодня
        <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
      </a>
    {/if}
  </aside>
{/if}

<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import { getIcon } from '$lib/design/icon-registry';
  import type { TodayWeekDay, TodayWeekEvent } from '$lib/today/today-view-model';

  export let labelledBy = 'today-week-title';
  export let weekLabel: string;
  export let days: TodayWeekDay[] = [];
  export let times: string[] = [];
  export let events: TodayWeekEvent[] = [];
</script>

<section class="today-week-board" aria-labelledby={labelledBy}>
  <div class="today-week-toolbar">
    <div class="today-week-toolbar__range">
      <button type="button">Сегодня</button>
      <div class="today-week-toolbar__arrows" aria-label="Переключить неделю">
        <button type="button" aria-label="Предыдущая неделя">
          <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Следующая неделя">
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <h2 id={labelledBy}>{weekLabel}</h2>
    </div>

    <div class="today-week-toolbar__view" aria-label="Вид календаря">
      <button type="button">День</button>
      <button class="today-week-toolbar__active" type="button">Неделя</button>
      <button type="button">Месяц</button>
    </div>

    <button class="today-week-toolbar__filter" type="button" aria-label="Фильтры календаря">
      <SlidersHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </div>

  <div class="today-week-grid">
    <div class="today-week-grid__corner" aria-hidden="true"></div>
    {#each days as day (day.id)}
      <div class:today-week-grid__day--active={day.isToday} class="today-week-grid__day">
        <span>{day.weekday}</span>
        <strong>{day.day}</strong>
      </div>
    {/each}

    {#each times as time, index (`time-${time}`)}
      <time class="today-week-grid__time" style={`grid-row: ${index + 2};`}>{time}</time>
    {/each}

    {#each days as day, dayIndex (`column-${day.id}`)}
      <div
        class:today-week-grid__column--active={day.isToday}
        class="today-week-grid__column"
        style={`grid-column: ${dayIndex + 2};`}
        aria-hidden="true"
      ></div>
    {/each}

    {#each events as event (event.id)}
      {@const Icon = getIcon(event.icon)}
      <article
        class={`today-week-event today-week-event--${event.color}`}
        style={`grid-column: ${event.dayIndex + 2}; grid-row: ${event.row + 1} / span ${event.span};`}
      >
        <div class="today-week-event__icon" aria-hidden="true">
          <svelte:component this={Icon} size={16} strokeWidth={2.25} />
        </div>
        <strong>{event.title}</strong>
        <span>{event.time} · {event.memberName}</span>
      </article>
    {/each}
  </div>
</section>

<script lang="ts">
  import type { TodayAllDayInfoViewModel } from '$lib/today/today-all-day';

  export let model: TodayAllDayInfoViewModel;
  export let labelledBy = 'today-all-day-title';
</script>

{#if model.items.length > 0}
  <section class="today-all-day" aria-labelledby={labelledBy}>
    <div class="today-all-day__header">
      <div>
        <p class="section-kicker">Весь день</p>
        <h2 id={labelledBy}>{model.title}</h2>
      </div>
      <span>{model.subtitle}</span>
    </div>

    <div class="today-all-day__list">
      {#each model.items as item (item.id)}
        <article class={`today-all-day-item today-all-day-item--${item.color}`}>
          <span
            class={`year-marker year-marker--${item.kind} year-marker--${item.color}`}
            aria-hidden="true"
          ></span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.meta}</p>
          </div>
          <span>{item.kindLabel}</span>
        </article>
      {/each}
    </div>
  </section>
{/if}

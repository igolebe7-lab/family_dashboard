<script lang="ts">
  import type { YearCalendarViewModel } from '$lib/calendar/year-calendar';

  export let model: YearCalendarViewModel;
  export let compact = false;

  const weekdayLabels = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
</script>

<section class:year-calendar--compact={compact} class="year-calendar" aria-label={`Календарь на ${model.year} год`}>
  {#each model.months as month (month.month)}
    <article class="year-month" aria-label={`${month.label} ${model.year}`}>
      <header class="year-month__header">
        <h2>{month.label}</h2>
      </header>

      <div class="year-month__weekdays" aria-hidden="true">
        <span>№</span>
        {#each weekdayLabels as label}
          <span>{label}</span>
        {/each}
      </div>

      <div class="year-month__weeks">
        {#each month.weeks as week (`${month.month}-${week.weekNumber}-${week.days[0].dateKey}`)}
          <div class="year-week">
            <span class="year-week__number">{week.weekNumber}</span>
            {#each week.days as day (day.dateKey)}
              <button
                class:year-day--muted={!day.inCurrentMonth}
                class:year-day--weekend={day.isWeekend}
                class:year-day--annotated={day.annotations.length > 0}
                class="year-day"
                type="button"
                aria-label={`${day.dateKey}, ${day.annotations.length} особых дат`}
              >
                <span class="year-day__number">{day.day}</span>
                {#if day.annotations.length > 0}
                  <span class="year-day__markers" aria-hidden="true">
                    {#each day.visibleAnnotations as annotation (annotation.id)}
                      <i class={`year-marker year-marker--${annotation.kind} year-marker--${annotation.color}`}></i>
                    {/each}
                    {#if day.hiddenAnnotationCount > 0}
                      <b>+{day.hiddenAnnotationCount}</b>
                    {/if}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    </article>
  {/each}
</section>

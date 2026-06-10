<script lang="ts">
  import type {
    YearCalendarDay,
    YearCalendarMonth,
    YearCalendarViewModel
  } from '$lib/calendar/year-calendar';

  export let model: YearCalendarViewModel;
  export let compact = false;
  export let selectedDateKey: string | undefined = undefined;
  export let onselectDay: ((day: YearCalendarDay) => void) | undefined = undefined;
  export let monthHref: ((month: YearCalendarMonth) => string) | undefined = undefined;

  const weekdayLabels = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
</script>

<section class:year-calendar--compact={compact} class="year-calendar" aria-label={`Календарь на ${model.year} год`}>
  {#each model.months as month (month.month)}
    <article class="year-month" aria-label={`${month.label} ${model.year}`}>
      <header class="year-month__header">
        <h2>{month.label}</h2>
        {#if monthHref}
          <a class="year-month__open-link" href={monthHref(month)} aria-label={`Открыть ${month.label} в месяце`}>
            Месяц
          </a>
        {/if}
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
                class:year-day--selected={day.dateKey === selectedDateKey}
                class="year-day"
                type="button"
                aria-pressed={day.dateKey === selectedDateKey}
                aria-label={`${day.dateKey}, ${day.annotations.length} особых дат`}
                on:click={() => onselectDay?.(day)}
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

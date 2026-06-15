<script lang="ts">
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import type { TodayMonthViewModel } from '$lib/today/today-month-calendar';

  export let model: TodayMonthViewModel;
  export let selectedDateKey: string;
</script>

<div class="today-month-grid" aria-label={`Месяц ${model.label}`}>
  <div class="today-month-grid__header" aria-hidden="true">
    <span>№</span>
    {#each model.weekdayLabels as label}
      <span>{label}</span>
    {/each}
  </div>

  <div class="today-month-grid__weeks">
    {#each model.weeks as week (`${model.month}-${week.weekNumber}`)}
      <div class="today-month-grid__week">
        <span class="today-month-grid__week-number">{week.weekNumber}</span>
        {#each week.days as day (day.dateKey)}
          <a
            class:today-month-day--muted={!day.inCurrentMonth}
            class:today-month-day--weekend={day.isWeekend}
            class:today-month-day--selected={day.dateKey === selectedDateKey}
            class:today-month-day--annotated={day.annotations.length > 0}
            class="today-month-day"
            href={buildTodayCalendarHref({ dateKey: day.dateKey, view: 'day' })}
            aria-label={`${day.dateKey}: ${day.annotations.length} особых дат, ${day.eventCount} событий`}
          >
            <span class="today-month-day__number">{day.day}</span>

            {#if day.primaryAnnotationTitle}
              <span class="today-month-day__annotation">{day.primaryAnnotationTitle}</span>
            {:else if day.eventCount > 0}
              <span class="today-month-day__annotation">{day.eventCount} события</span>
            {:else}
              <span class="today-month-day__annotation today-month-day__annotation--empty"> </span>
            {/if}

            <span class="today-month-day__footer">
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

              {#if day.eventCount > 0}
                <span class="today-month-day__event-count">{day.eventCount}</span>
              {/if}
            </span>
          </a>
        {/each}
      </div>
    {/each}
  </div>
</div>

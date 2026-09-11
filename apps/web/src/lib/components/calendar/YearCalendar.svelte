<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  export let recordMarkers: Array<{
    dateKey: string;
    kind: 'event' | 'task' | 'assignment';
    count: number;
  }> = [];

  const weekdayLabels = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
  let calendarElement: HTMLElement;
  let scrolledYear: number | null = null;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  $: recordMarkersByDate = recordMarkers.reduce((markersByDate, marker) => {
    const existing = markersByDate.get(marker.dateKey) ?? [];
    markersByDate.set(marker.dateKey, [...existing, marker]);
    return markersByDate;
  }, new Map<string, typeof recordMarkers>());

  $: if (calendarElement && scrolledYear !== model.year) {
    void scrollCurrentMonthIntoView();
  }

  async function scrollCurrentMonthIntoView(): Promise<void> {
    await tick();
    if (!calendarElement.clientHeight) return;
    scrolledYear = model.year;

    const currentMonth = calendarElement.querySelector<HTMLElement>(
      `[data-month="${now.getFullYear() === model.year ? now.getMonth() + 1 : 1}"]`
    );
    if (!currentMonth) return;

    const top = currentMonth.getBoundingClientRect().top - calendarElement.getBoundingClientRect().top + calendarElement.scrollTop;
    calendarElement.scrollTo({ top: Math.max(0, top) });
  }

  onMount(() => {
    // Hidden mobile/desktop instances must wait until their layout is visible.
    const observer = new ResizeObserver(() => {
      if (calendarElement.clientHeight && scrolledYear !== model.year) void scrollCurrentMonthIntoView();
    });
    observer.observe(calendarElement);
    void scrollCurrentMonthIntoView();
    return () => observer.disconnect();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users can scroll the named calendar region.) -->
<section
  bind:this={calendarElement}
  class:year-calendar--compact={compact}
  class="year-calendar"
  aria-label={`Календарь на ${model.year} год`}
  tabindex="0"
>
  {#each model.months as month (month.month)}
    <article class="year-month" data-month={month.month} aria-label={`${month.label} ${model.year}`}>
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
                class:year-day--today={day.inCurrentMonth && day.dateKey === todayKey}
                class="year-day"
                type="button"
                aria-pressed={day.dateKey === selectedDateKey}
                aria-current={day.inCurrentMonth && day.dateKey === todayKey ? 'date' : undefined}
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
                {#if recordMarkersByDate.has(day.dateKey)}
                  {@const markers = recordMarkersByDate.get(day.dateKey)}
                  {#if markers}
                    <span class="year-day__record-markers" aria-hidden="true">
                      {#each markers as marker (`${marker.kind}-${marker.count}`)}
                        <i class={`year-record-marker year-record-marker--${marker.kind}`}></i>
                        {#if marker.count > 1}
                          <b>{marker.count}</b>
                        {/if}
                      {/each}
                    </span>
                  {/if}
                {/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    </article>
  {/each}
</section>

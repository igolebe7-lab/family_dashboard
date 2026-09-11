<script lang="ts">
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import type { TodayMonthViewModel } from '$lib/today/today-month-calendar';
  import type { TodayMonthDay } from '$lib/today/today-month-calendar';
  import { onDestroy } from 'svelte';
  import MonthDayPreview from './MonthDayPreview.svelte';

  export let model: TodayMonthViewModel;
  export let selectedDateKey: string;
  let previewDate: string | null = null;
  let anchor: HTMLElement;
  let touch = false;
  let pinned = false;
  const plural = new Intl.PluralRules('ru');
  function countLabel(count: number) { return `${count} ${{ one: 'запись', few: 'записи', many: 'записей', other: 'записи' }[plural.select(count) as 'one' | 'few' | 'many' | 'other']}`; }
  let closeTimer: ReturnType<typeof setTimeout>;
  $: previewDay = model.weeks.flatMap(week => week.days).find(day => day.dateKey === previewDate);
  function closePreview() { clearTimeout(closeTimer); previewDate = null; pinned = false; }
  function keepPreview() { clearTimeout(closeTimer); }
  function leavePreview() { if (pinned) return; clearTimeout(closeTimer); closeTimer = setTimeout(closePreview, 250); }
  function openPreview(day: TodayMonthDay, element: HTMLElement, mobile: boolean) {
    keepPreview(); anchor = element; touch = mobile; previewDate = day.dateKey;
  }
  function hoverDay(event: PointerEvent, day: TodayMonthDay) {
    if (event.pointerType !== 'mouse' || !day.events.length) return;
    if (pinned) return;
    openPreview(day, event.currentTarget as HTMLElement, false);
  }
  function clickDay(event: MouseEvent, day: TodayMonthDay) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pinned = true;
    openPreview(day, event.currentTarget as HTMLElement, matchMedia('(hover: none), (max-width: 1023px)').matches);
  }
  onDestroy(() => clearTimeout(closeTimer));
</script>

<div class="today-month-grid" aria-label={`Месяц ${model.label}`}>
  <div class="today-month-grid__header" aria-hidden="true">
    <span>№</span>
    {#each model.weekdayLabels as label}
      <span>{label}</span>
    {/each}
  </div>

  <div class="today-month-grid__weeks" on:scroll={closePreview}>
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
            aria-haspopup="dialog"
            aria-expanded={previewDate === day.dateKey}
            on:pointerenter={(event) => hoverDay(event, day)}
            on:pointerleave={leavePreview}
            on:click={(event) => clickDay(event, day)}
          >
            <span class="today-month-day__number">{day.day}</span>

            {#if day.primaryAnnotationTitle}
              <span class="today-month-day__annotation">{day.primaryAnnotationTitle}</span>
            {:else if day.eventCount > 0}
              <span class="today-month-day__annotation">{countLabel(day.eventCount)}</span>
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

{#if previewDay}
  {#key `${previewDay.dateKey}:${touch}`}
    <MonthDayPreview day={previewDay} {anchor} {touch} focusOnOpen={pinned} onclose={closePreview} onenter={keepPreview} onleave={() => { if (!touch) leavePreview(); }} />
  {/key}
{/if}

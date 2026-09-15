<script lang="ts">
  import { tick } from 'svelte';
  import { addDays, addMonths } from 'date-fns';
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import { ITEM_CATEGORIES, getCategoryMeta, type ItemCategory } from '$lib/constants/categories';
  import { formatDateKey } from '$lib/today/today-view-model';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import CalendarEventCard from './CalendarEventCard.svelte';
  import TodayMonthGrid from './TodayMonthGrid.svelte';
  import { itemDetailsStore } from '$lib/stores/item-details.store';
  import {
    CALENDAR_END_HOUR,
    CALENDAR_START_HOUR,
    HOUR_HEIGHT,
    getCalendarBodyHeight,
    getCalendarEventTop,
    getCalendarInitialScrollTop,
    layoutCalendarEvents
  } from '$lib/today/week-calendar';
  import { createTodayMonthViewModel } from '$lib/today/today-month-calendar';
  import type { DayAnnotation } from '$lib/types/domain';
  import type { TodayWeekDay, TodayWeekEvent } from '$lib/today/today-view-model';

  type CalendarView = 'day' | 'week' | 'month';

  export let labelledBy = 'today-week-title';
  export let initialView: CalendarView = 'week';
  export let selectedDate: Date;
  export let selectedDateKey: string;
  export let weekLabel: string;
  export let days: TodayWeekDay[] = [];
  export let times: string[] = [];
  export let events: TodayWeekEvent[] = [];
  export let annotations: DayAnnotation[] = [];
  export let onnavigate: ((date: Date, view: CalendarView) => void) | undefined = undefined;
  export let contextKey = '';
  export let mobile = false;

  $: selectedView = initialView;
  let filtersOpen = false;
  let selectedCategories: ItemCategory[] = [];
  $: if (contextKey) selectedCategories = [];
  $: filteredEvents = events.filter((event) => selectedCategories.length === 0 || (event.category && selectedCategories.includes(event.category)));
  let calendarScrollElement: HTMLDivElement | undefined;
  let focusedRange: string | null = null;

  $: calendarBodyHeight = getCalendarBodyHeight();
  $: calendarStyle = `--calendar-start-hour:${CALENDAR_START_HOUR}; --calendar-end-hour:${CALENDAR_END_HOUR}; --hour-height:${HOUR_HEIGHT}px; --mobile-week-columns:52px ${dayLayouts.map(day => `${day.width}px`).join(' ')}; --mobile-week-width:${52 + dayLayouts.reduce((sum, day) => sum + day.width, 0)}px;`;
  $: selectedDay = days.find((day) => day.dateKey === selectedDateKey) ?? days.find((day) => day.isToday);
  $: visibleDays = selectedView === 'day' ? (selectedDay ? [selectedDay] : days.slice(0, 1)) : days;
  $: visibleEvents = filteredEvents.filter((event) => visibleDays.some((day) => day.dateKey === event.day));
  $: dayLayouts = visibleDays.map(day => {
    const entries = layoutCalendarEvents(filteredEvents.filter(event => event.day === day.dateKey && !event.allDay));
    return { day, entries, width: Math.max(168, ...entries.map(entry => entry.columnCount * 128)) };
  });
  $: scrollRangeKey = `${contextKey}:${selectedDateKey}:${selectedView}:${selectedCategories.join(',')}`;
  $: if (calendarScrollElement) void scrollToFirstEvent(visibleEvents, scrollRangeKey);
  $: monthModel = createTodayMonthViewModel({
    annotations,
    date: selectedDate,
    events: filteredEvents
  });
  $: rangeLabel = selectedView === 'month' ? monthModel.label : selectedView === 'day'
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDate) : weekLabel;
  $: previousLabel = selectedView === 'month' ? 'Предыдущий месяц' : selectedView === 'day' ? 'Предыдущий день' : 'Предыдущая неделя';
  $: nextLabel = selectedView === 'month' ? 'Следующий месяц' : selectedView === 'day' ? 'Следующий день' : 'Следующая неделя';
  $: previousDate = selectedView === 'month' ? addMonths(selectedDate, -1) : addDays(selectedDate, selectedView === 'week' ? -7 : -1);
  $: nextDate = selectedView === 'month' ? addMonths(selectedDate, 1) : addDays(selectedDate, selectedView === 'week' ? 7 : 1);

  async function scrollToFirstEvent(currentEvents: TodayWeekEvent[], rangeKey: string): Promise<void> {
    await tick();
    if (rangeKey !== scrollRangeKey || currentEvents !== visibleEvents) return;
    if (!calendarScrollElement?.clientHeight || !currentEvents.length || focusedRange === rangeKey) return;
    calendarScrollElement.scrollTop = getCalendarInitialScrollTop(currentEvents.filter(event => !event.allDay));
    if (mobile) {
      const index = visibleDays.findIndex(day => day.dateKey === selectedDateKey);
      calendarScrollElement.scrollLeft = dayLayouts.slice(0, Math.max(0, index)).reduce((sum, day) => sum + day.width, 0);
    }
    focusedRange = rangeKey;
  }

  function observeCalendarSize(element: HTMLDivElement, enabled: boolean) {
    if (!enabled) return;
    calendarScrollElement = element;
    let wasVisible = false;
    const observer = new ResizeObserver(() => {
      const visible = element.clientHeight > 0 && element.clientWidth > 0;
      if (visible && !wasVisible) {
        focusedRange = null;
        void scrollToFirstEvent(visibleEvents, scrollRangeKey);
      }
      wasVisible = visible;
    });
    observer.observe(element);
    return { destroy() { observer.disconnect(); if (calendarScrollElement === element) calendarScrollElement = undefined; } };
  }

  function setView(view: CalendarView): void {
    if (onnavigate) onnavigate(selectedDate, view);
    else initialView = view;
  }
</script>

<section class:today-week-board--mobile={mobile} class:today-week-board--day={selectedView === 'day'} class="today-week-board" aria-labelledby={labelledBy}>
  <div class="today-week-toolbar">
    <div class="today-week-toolbar__range">
      <a class="button" href={buildTodayCalendarHref({ dateKey: formatDateKey(new Date()), view: selectedView })} data-sveltekit-noscroll>Сегодня</a>
      <div class="today-week-toolbar__arrows" aria-label="Переключить период">
        <a class="icon-button" href={buildTodayCalendarHref({ dateKey: formatDateKey(previousDate), view: selectedView })} aria-label={previousLabel} data-sveltekit-noscroll>
          <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
        </a>
        <a class="icon-button" href={buildTodayCalendarHref({ dateKey: formatDateKey(nextDate), view: selectedView })} aria-label={nextLabel} data-sveltekit-noscroll>
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </a>
      </div>
      <h2 id={labelledBy}>{rangeLabel}</h2>
    </div>

    <div class="today-week-toolbar__view" aria-label="Вид календаря">
      <button
        class:today-week-toolbar__active={selectedView === 'day'}
        type="button"
        aria-pressed={selectedView === 'day'}
        on:click={() => setView('day')}>День</button
      >
      <button
        class:today-week-toolbar__active={selectedView === 'week'}
        type="button"
        aria-pressed={selectedView === 'week'}
        on:click={() => setView('week')}>Неделя</button
      >
      <button
        class:today-week-toolbar__active={selectedView === 'month'}
        type="button"
        aria-pressed={selectedView === 'month'}
        on:click={() => setView('month')}>Месяц</button
      >
    </div>

    {#if !mobile || selectedView !== 'day'}<button class="today-week-toolbar__filter" type="button" aria-label="Фильтры календаря" aria-expanded={filtersOpen} aria-controls={`${labelledBy}-filters`} on:click={() => (filtersOpen = !filtersOpen)}>
      <SlidersHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
    </button>{/if}
  </div>

  {#if filtersOpen && (!mobile || selectedView !== 'day')}
    <fieldset id={`${labelledBy}-filters`} class="calendar-category-filters">
      <legend>Категории</legend>
      {#each ITEM_CATEGORIES as category}
        <label><input type="checkbox" value={category} bind:group={selectedCategories} /> {getCategoryMeta(category).label}</label>
      {/each}
      <button class="button" type="button" on:click={() => (selectedCategories = [])}>Сбросить</button>
    </fieldset>
  {/if}

  {#if selectedView === 'month'}
    {#key `${contextKey}:${monthModel.year}:${monthModel.month}`}
    <TodayMonthGrid model={monthModel} {selectedDateKey} />
    {/key}
  {:else if mobile && selectedView === 'day'}
    <slot />
  {:else}
    {#if visibleEvents.some(event => event.allDay)}
      <div class="today-all-day-strip" aria-label="Весь день">
        {#each visibleEvents.filter(event => event.allDay) as event (event.id)}
          <button type="button" class={`today-all-day-pill week-all-day-pill today-all-day-pill--${event.color}`} on:click={() => event.itemId && itemDetailsStore.set(event.itemId)}>
            <span><strong>{event.title}</strong><small>Весь день · {event.day} · {event.memberName}</small></span>
          </button>
        {/each}
      </div>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The two-axis scroll region must be keyboard focusable.) -->
    <div use:observeCalendarSize={mobile} class:week-calendar--mobile={mobile} class:week-calendar--day={selectedView === 'day'} class="week-calendar" style={calendarStyle} tabindex={mobile ? 0 : undefined} role="region" aria-label="Расписание недели">
    <div class="week-calendar__header">
      <div class="week-calendar__corner" aria-hidden="true"></div>
      {#each visibleDays as day (day.id)}
        <div class:week-calendar__day--active={day.isToday} class="week-calendar__day">
          <span>{day.weekday}</span>
          <strong>{day.day}</strong>
        </div>
      {/each}
    </div>

    <div use:observeCalendarSize={!mobile} class="week-calendar__body-scroll" aria-label="Сетка времени недели">
      <div class="week-calendar__body" style={`height:${calendarBodyHeight + 64}px;`}>
        <div class="week-calendar__time-scale">
          {#each times as time (`time-${time}`)}
            <time class="week-calendar__time-label" style={`top:${getCalendarEventTop(time)}px;`}>
              {time}
            </time>
          {/each}
        </div>

        {#each dayLayouts as layout (layout.day.id)}
          {@const day = layout.day}
          <section
            class:week-calendar__day-column--active={day.isToday}
            class="week-calendar__day-column"
            aria-label={`События на ${day.day} ${day.month}`}
          >
            <div class="week-calendar__hour-lines" aria-hidden="true"></div>
            <div class="week-calendar__events-layer">
              {#each layout.entries as entry (entry.event.id)}
                <CalendarEventCard
                  event={entry.event}
                  positionStyle={`top:${entry.top}px; height:${entry.height}px; left:calc(${entry.column * 100 / entry.columnCount}% + 3px); width:calc(${100 / entry.columnCount}% - 6px); right:auto;`}
                />
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
    </div>
  {/if}
</section>

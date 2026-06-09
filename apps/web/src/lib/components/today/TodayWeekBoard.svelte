<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import CalendarEventCard from './CalendarEventCard.svelte';
  import {
    CALENDAR_END_HOUR,
    CALENDAR_START_HOUR,
    HOUR_HEIGHT,
    getCalendarBodyHeight,
    getCalendarEventHeight,
    getCalendarEventTop
  } from '$lib/today/week-calendar';
  import type { TodayWeekDay, TodayWeekEvent } from '$lib/today/today-view-model';

  export let labelledBy = 'today-week-title';
  export let weekLabel: string;
  export let days: TodayWeekDay[] = [];
  export let times: string[] = [];
  export let events: TodayWeekEvent[] = [];

  $: calendarBodyHeight = getCalendarBodyHeight();
  $: calendarStyle = `--calendar-start-hour:${CALENDAR_START_HOUR}; --calendar-end-hour:${CALENDAR_END_HOUR}; --hour-height:${HOUR_HEIGHT}px;`;

  function eventsForDay(day: TodayWeekDay): TodayWeekEvent[] {
    return events.filter((event) => event.day === day.dateKey);
  }
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

  <div class="week-calendar" style={calendarStyle}>
    <div class="week-calendar__header">
      <div class="week-calendar__corner" aria-hidden="true"></div>
      {#each days as day (day.id)}
        <div class:week-calendar__day--active={day.isToday} class="week-calendar__day">
          <span>{day.weekday}</span>
          <strong>{day.day}</strong>
        </div>
      {/each}
    </div>

    <div class="week-calendar__body-scroll" aria-label="Сетка времени недели">
      <div class="week-calendar__body" style={`height:${calendarBodyHeight}px;`}>
        <div class="week-calendar__time-scale">
          {#each times as time (`time-${time}`)}
            <time class="week-calendar__time-label" style={`top:${getCalendarEventTop(time)}px;`}>
              {time}
            </time>
          {/each}
        </div>

        {#each days as day (day.id)}
          <section
            class:week-calendar__day-column--active={day.isToday}
            class="week-calendar__day-column"
            aria-label={`События на ${day.day} ${day.month}`}
          >
            <div class="week-calendar__hour-lines" aria-hidden="true"></div>
            <div class="week-calendar__events-layer">
              {#each eventsForDay(day) as event (event.id)}
                <CalendarEventCard
                  {event}
                  positionStyle={`top:${getCalendarEventTop(event.start)}px; height:${getCalendarEventHeight(
                    event.durationMinutes
                  )}px;`}
                />
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  </div>
</section>

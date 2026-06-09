<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Chip from '$lib/components/ui/Chip.svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import FloatingCreateButton from '$lib/components/app/FloatingCreateButton.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';

  const activeRoute = '/app/calendar';
  const viewOptions = [
    { label: 'День', value: 'day' },
    { label: 'Неделя', value: 'week' },
    { label: 'Месяц', value: 'month' }
  ] as const;

  const week = [
    { day: 'Пн', date: '12', dots: ['lavender', 'blue'] },
    { day: 'Вт', date: '13', dots: ['blue', 'peach'] },
    { day: 'Ср', date: '14', dots: ['blue'] },
    { day: 'Чт', date: '15', active: true, dots: ['lavender', 'green', 'peach'] },
    { day: 'Пт', date: '16', dots: ['lavender'] },
    { day: 'Сб', date: '17', dots: ['blue', 'green', 'peach'] },
    { day: 'Вс', date: '18', dots: ['blue', 'peach'] }
  ];

  const events = [
    { time: '08:00', title: 'Школа', person: 'Миша', color: 'green' },
    { time: '10:30', title: 'Врач', person: 'мама', color: 'lavender' },
    { time: '16:00', title: 'Забрать заказ', person: 'папа', color: 'blue' },
    { time: '18:00', title: 'Тренировка', person: 'Аня', color: 'peach' },
    { time: '20:00', title: 'Семейный ужин', person: 'Вся семья', color: 'yellow' }
  ];
</script>

<MobileShell {activeRoute} labelledBy="calendar-title-mobile" calendar>
    <header class="top-row">
      <h1 id="calendar-title-mobile">Календарь</h1>
      <button class="icon-button" type="button" aria-label="Открыть уведомления">
        <Bell size={23} strokeWidth={2.2} aria-hidden="true" />
        <span class="notification-dot" aria-hidden="true"></span>
      </button>
    </header>

    <SegmentedControl label="Вид календаря" options={viewOptions} selected="week" />

    <section class="week-strip" aria-label="Неделя">
      {#each week as item}
        <button class:week-day--active={item.active === true} class="week-day" type="button">
          <span>{item.day}</span>
          <strong>{item.date}</strong>
          <span class="dot-row" aria-hidden="true">
            {#each item.dots as dot}
              <span class="dot dot--{dot}"></span>
            {/each}
          </span>
        </button>
      {/each}
    </section>

    <Card labelledBy="selected-day" className="calendar-card">
      <div class="section-title-row">
        <h2 id="selected-day">Четверг, 15 мая</h2>
        <CalendarDays size={22} strokeWidth={2.1} aria-hidden="true" />
      </div>

      <div class="filter-row" aria-label="Фильтры категорий">
        <Chip active>Все</Chip>
        <Chip>Семья</Chip>
        <Chip>Дом</Chip>
        <Chip>Школа</Chip>
      </div>

      <div class="day-agenda">
        {#each events as event}
          <article class="timeline-item timeline-item--{event.color}">
            <time>{event.time}</time>
            <div>
              <h3>{event.title}</h3>
              <p>{event.person}</p>
            </div>
          </article>
        {/each}
      </div>
    </Card>
</MobileShell>

<FloatingCreateButton />

<DesktopShell {activeRoute} labelledBy="calendar-title-desktop">
  <div class="desktop-header">
    <div>
      <h1 id="calendar-title-desktop">Календарь</h1>
      <p class="offline-note">Неделя 12 — 18 мая. Данные пока демонстрационные до подключения PocketBase.</p>
    </div>
    <SegmentedControl label="Вид календаря на desktop" options={viewOptions} selected="week" />
    <Button variant="primary">+ Создать</Button>
  </div>

  <section class="desktop-calendar-board" aria-label="Недельная сетка">
    <div class="desktop-calendar-week-header" aria-hidden="true">
      {#each week as day}
        <div class:desktop-calendar-day-heading--active={day.active === true} class="desktop-calendar-day-heading">
          <span>{day.day}</span>
          <strong>{day.date} мая</strong>
        </div>
      {/each}
    </div>

    <div class="desktop-calendar-scroll" aria-label="События недели">
      <div class="desktop-grid">
        {#each week as day, index}
          <article class="desktop-day" aria-label={`${day.day}, ${day.date} мая`}>
            {#each events.filter((_, eventIndex) => eventIndex % 3 === index % 3) as event}
              <div class="desktop-event desktop-event--{event.color}">
                <strong>{event.time}</strong>
                <span>{event.title}</span>
                <small>{event.person}</small>
              </div>
            {/each}
          </article>
        {/each}
      </div>
    </div>
  </section>

  <svelte:fragment slot="aside">
    <section class="attention-grid" aria-labelledby="calendar-attention-title">
      <h2 id="calendar-attention-title">Нужно внимание</h2>
      <article class="attention-card attention-card--green">
        <span class="mini-avatar">М</span>
        <p>Миша ждёт подтверждения поручения</p>
      </article>
      <article class="attention-card attention-card--peach">
        <span class="mini-avatar">А</span>
        <p>Подготовить форму к тренировке</p>
      </article>
    </section>
    <section aria-labelledby="calendar-actions-title">
      <h2 id="calendar-actions-title">Быстрые действия</h2>
      <div class="quick-actions">
        <button class="quick-action quick-action--green" type="button">+ Дело</button>
        <button class="quick-action quick-action--lavender" type="button">+ Поручение</button>
        <button class="quick-action quick-action--peach" type="button">+ Событие</button>
      </div>
    </section>
  </svelte:fragment>
</DesktopShell>

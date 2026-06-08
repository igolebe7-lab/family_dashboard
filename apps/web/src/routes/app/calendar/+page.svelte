<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Plus from '@lucide/svelte/icons/plus';

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

<main class="app-screen app-screen--calendar" aria-labelledby="calendar-title">
  <section class="mobile-shell">
    <header class="top-row">
      <h1 id="calendar-title">Календарь</h1>
      <button class="icon-button" type="button" aria-label="Открыть уведомления">
        <Bell size={23} strokeWidth={2.2} aria-hidden="true" />
        <span class="notification-dot" aria-hidden="true"></span>
      </button>
    </header>

    <div class="segmented" role="tablist" aria-label="Вид календаря">
      <button type="button" role="tab">День</button>
      <button class="segmented__active" type="button" role="tab" aria-selected="true">Неделя</button>
      <button type="button" role="tab">Месяц</button>
    </div>

    <section class="week-strip" aria-label="Неделя">
      {#each week as item}
        <button class:week-day--active={item.active} class="week-day" type="button">
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

    <section class="shell-card calendar-card" aria-labelledby="selected-day">
      <div class="section-title-row">
        <h2 id="selected-day">Четверг, 15 мая</h2>
        <CalendarDays size={22} strokeWidth={2.1} aria-hidden="true" />
      </div>

      <div class="filter-row" aria-label="Фильтры категорий">
        <button class="chip chip--active" type="button">Все</button>
        <button class="chip" type="button">Семья</button>
        <button class="chip" type="button">Дом</button>
        <button class="chip" type="button">Школа</button>
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
    </section>
  </section>

  <button class="fab" type="button" aria-label="Создать событие, дело или поручение">
    <Plus size={30} strokeWidth={2.4} aria-hidden="true" />
  </button>
</main>

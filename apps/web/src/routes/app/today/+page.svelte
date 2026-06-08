<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import CheckSquare from '@lucide/svelte/icons/square-check-big';
  import UsersRound from '@lucide/svelte/icons/users-round';
  import { createShellViewModel } from '$lib/app-shell';

  const shell = createShellViewModel({ apiAvailable: false });

  const family = [
    { name: 'Мама', color: 'lavender' },
    { name: 'Папа', color: 'blue' },
    { name: 'Миша', color: 'green' },
    { name: 'Аня', color: 'peach' }
  ];

  const timeline = [
    { time: '08:00', title: 'Школа', person: 'Миша', color: 'green' },
    { time: '10:30', title: 'Врач', person: 'мама', color: 'lavender' },
    { time: '18:00', title: 'Тренировка', person: 'Аня', color: 'peach' }
  ];
</script>

<main class="app-screen" aria-labelledby="today-title">
  <section class="mobile-shell">
    <header class="top-row">
      <div>
        <p class="eyebrow">FamilyTime</p>
        <h1 id="today-title">{shell.greeting} ☀️</h1>
      </div>
      <button class="icon-button" type="button" aria-label="Открыть уведомления">
        <Bell size={23} strokeWidth={2.2} aria-hidden="true" />
        <span class="notification-dot" aria-hidden="true"></span>
      </button>
    </header>

    <section class="family-row" aria-label="Члены семьи">
      {#each family as member}
        <button class="member-pill member-pill--{member.color}" type="button">
          <span class="member-avatar" aria-hidden="true">{member.name.slice(0, 1)}</span>
          <span>{member.name}</span>
        </button>
      {/each}
    </section>

    <section class="shell-card" aria-labelledby="today-card-title">
      <div class="section-title-row">
        <h2 id="today-card-title">Сегодня</h2>
        <CalendarDays size={22} strokeWidth={2.1} aria-hidden="true" />
      </div>

      <div class="timeline-list">
        {#each timeline as item}
          <article class="timeline-item timeline-item--{item.color}">
            <time>{item.time}</time>
            <div>
              <h3>{item.title}</h3>
              <p>{item.person}</p>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="attention-grid" aria-labelledby="attention-title">
      <h2 id="attention-title">Нужно внимание</h2>
      <article class="attention-card attention-card--green">
        <span class="mini-avatar">М</span>
        <p>Миша отметил «Вынести мусор» как готово — подтвердить</p>
      </article>
      <article class="attention-card attention-card--peach">
        <span class="mini-avatar">А</span>
        <p>Завтра у Ани тренировка — подготовить форму</p>
      </article>
    </section>

    <section aria-labelledby="quick-title">
      <h2 id="quick-title">Быстрые действия</h2>
      <div class="quick-actions">
        <button class="quick-action quick-action--green" type="button">+ Дело</button>
        <button class="quick-action quick-action--lavender" type="button">+ Поручение</button>
        <button class="quick-action quick-action--peach" type="button">+ Событие</button>
      </div>
    </section>

    <p class="offline-note" role="status">{shell.message}</p>
  </section>

  <nav class="bottom-nav" aria-label="Основная навигация">
    <a class="bottom-nav__item bottom-nav__item--active" href="/app/today">
      <CalendarDays size={23} aria-hidden="true" />
      <span>Сегодня</span>
    </a>
    <a class="bottom-nav__item" href="/app/calendar">
      <CalendarDays size={23} aria-hidden="true" />
      <span>Календарь</span>
    </a>
    <a class="bottom-nav__item" href="/app/assignments">
      <CheckSquare size={23} aria-hidden="true" />
      <span>Поручения</span>
    </a>
    <a class="bottom-nav__item" href="/app/family">
      <UsersRound size={23} aria-hidden="true" />
      <span>Семья</span>
    </a>
  </nav>
</main>

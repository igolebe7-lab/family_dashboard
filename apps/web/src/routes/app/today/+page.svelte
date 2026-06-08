<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import { createShellViewModel } from '$lib/app-shell';

  const shell = createShellViewModel({ apiAvailable: false });
  const activeRoute = '/app/today';

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

<MobileShell {activeRoute} labelledBy="today-title-mobile">
    <header class="top-row">
      <div>
        <p class="eyebrow">FamilyTime</p>
        <h1 id="today-title-mobile">{shell.greeting} ☀️</h1>
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

    <Card labelledBy="today-card-title">
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
    </Card>

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
</MobileShell>

<DesktopShell {activeRoute} labelledBy="today-title-desktop">
  <div class="desktop-header">
    <div>
      <h1 id="today-title-desktop">{shell.greeting} ☀️</h1>
      <p class="offline-note">{shell.message}</p>
    </div>
    <Button variant="primary">+ Создать</Button>
  </div>

  <Card labelledBy="desktop-today-card">
    <div class="section-title-row">
      <h2 id="desktop-today-card">Сегодня</h2>
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
  </Card>

  <svelte:fragment slot="aside">
    <section class="attention-grid" aria-labelledby="desktop-attention-title">
      <h2 id="desktop-attention-title">Нужно внимание</h2>
      <article class="attention-card attention-card--green">
        <span class="mini-avatar">М</span>
        <p>Миша отметил «Вынести мусор» как готово — подтвердить</p>
      </article>
      <article class="attention-card attention-card--peach">
        <span class="mini-avatar">А</span>
        <p>Завтра у Ани тренировка — подготовить форму</p>
      </article>
    </section>
    <section aria-labelledby="desktop-quick-title">
      <h2 id="desktop-quick-title">Быстрые действия</h2>
      <div class="quick-actions">
        <button class="quick-action quick-action--green" type="button">+ Дело</button>
        <button class="quick-action quick-action--lavender" type="button">+ Поручение</button>
        <button class="quick-action quick-action--peach" type="button">+ Событие</button>
      </div>
    </section>
  </svelte:fragment>
</DesktopShell>

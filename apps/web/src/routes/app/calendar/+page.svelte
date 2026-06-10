<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import { onDestroy, onMount } from 'svelte';
  import { get, type Unsubscriber } from 'svelte/store';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Chip from '$lib/components/ui/Chip.svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import FloatingCreateButton from '$lib/components/app/FloatingCreateButton.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
  import type { ItemCategory } from '$lib/constants/categories';
  import { getCategoryMeta } from '$lib/constants/categories';
  import { calendarStore } from '$lib/stores/calendar.store';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import type { ItemOccurrence } from '$lib/types/domain';

  const activeRoute = '/app/calendar';
  let familyUnsubscribe: Unsubscriber | undefined;
  let loadedRangeKey: string | null = null;

  async function loadCalendarFromFamilyState(familyState: FamilyState) {
    const context = getActiveFamilyContext(familyState);
    if (!context) return;

    const calendarState = get(calendarStore);
    const rangeKey = `${context.familyId}:${context.memberId}:${calendarState.visibleRange.from}:${calendarState.visibleRange.to}`;
    if (loadedRangeKey === rangeKey) return;
    loadedRangeKey = rangeKey;

    try {
      await calendarStore.loadVisibleOccurrences(context);
    } catch (error) {
      console.warn('Failed to load Calendar occurrences from PocketBase, keeping demo calendar.', error);
    }
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((familyState) => {
      if (familyState.status !== 'ready') return;
      void loadCalendarFromFamilyState(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });

  const viewOptions = [
    { label: 'День', value: 'day' },
    { label: 'Неделя', value: 'week' },
    { label: 'Месяц', value: 'month' }
  ] as const;
  const categoryFilterOptions: Array<{ label: string; value: ItemCategory }> = [
    { label: 'Семья', value: 'family' },
    { label: 'Дом', value: 'home' },
    { label: 'Школа', value: 'school' },
    { label: 'Спорт', value: 'sport' }
  ];

  const week = [
    { day: 'Пн', date: '12', dots: ['lavender', 'blue'] },
    { day: 'Вт', date: '13', dots: ['blue', 'peach'] },
    { day: 'Ср', date: '14', dots: ['blue'] },
    { day: 'Чт', date: '15', active: true, dots: ['lavender', 'green', 'peach'] },
    { day: 'Пт', date: '16', dots: ['lavender'] },
    { day: 'Сб', date: '17', dots: ['blue', 'green', 'peach'] },
    { day: 'Вс', date: '18', dots: ['blue', 'peach'] }
  ];

  type CalendarEventCard = {
    time: string;
    title: string;
    person: string;
    color: string;
    category: ItemCategory;
  };

  const demoEvents: CalendarEventCard[] = [
    { time: '08:00', title: 'Школа', person: 'Миша', color: 'green', category: 'school' },
    { time: '10:30', title: 'Врач', person: 'мама', color: 'lavender', category: 'health' },
    { time: '16:00', title: 'Забрать заказ', person: 'папа', color: 'blue', category: 'shopping' },
    { time: '18:00', title: 'Тренировка', person: 'Аня', color: 'peach', category: 'sport' },
    { time: '20:00', title: 'Семейный ужин', person: 'Вся семья', color: 'yellow', category: 'family' }
  ];

  $: displayEvents =
    $calendarStore.occurrences.length > 0
      ? $calendarStore.filteredOccurrences.map(mapOccurrenceToEventCard)
      : demoEvents.filter((event) =>
          $calendarStore.filters.categories.length === 0 ||
          $calendarStore.filters.categories.includes(event.category)
        );

  function mapOccurrenceToEventCard(occurrence: ItemOccurrence): CalendarEventCard {
    const meta = getCategoryMeta(occurrence.categorySnapshot);
    const timestamp = occurrence.startAt ?? occurrence.dueAt ?? occurrence.endAt;

    return {
      time: timestamp ? formatEventTime(timestamp) : 'Весь день',
      title: occurrence.titleSnapshot,
      person: occurrence.visibleTo.length > 1 ? 'Вся семья' : occurrence.visibleTo[0] ?? 'Семья',
      color: meta.color,
      category: occurrence.categorySnapshot
    };
  }

  function formatEventTime(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }
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
        <Chip active={$calendarStore.filters.categories.length === 0} onclick={() => calendarStore.clearCategories()}>
          Все
        </Chip>
        {#each categoryFilterOptions as option (option.value)}
          <Chip
            active={$calendarStore.filters.categories.includes(option.value)}
            onclick={() => calendarStore.toggleCategory(option.value)}
          >
            {option.label}
          </Chip>
        {/each}
      </div>

      {#if $familyStore.members.length > 0}
        <div class="filter-row" aria-label="Фильтры участников">
          <Chip active={$calendarStore.filters.members.length === 0} onclick={() => calendarStore.clearMembers()}>
            Все
          </Chip>
          {#each $familyStore.members as member (member.id)}
            <Chip
              active={$calendarStore.filters.members.includes(member.id)}
              onclick={() => calendarStore.toggleMember(member.id)}
            >
              {member.displayName}
            </Chip>
          {/each}
        </div>
      {/if}

      <div class="day-agenda">
        {#each displayEvents as event}
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
            {#each displayEvents.filter((_, eventIndex) => eventIndex % 3 === index % 3) as event}
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

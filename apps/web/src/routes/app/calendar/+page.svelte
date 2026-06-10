<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { onDestroy, onMount } from 'svelte';
  import { get, type Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import FloatingCreateButton from '$lib/components/app/FloatingCreateButton.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import DayDetailSheet from '$lib/components/calendar/DayDetailSheet.svelte';
  import YearCalendar from '$lib/components/calendar/YearCalendar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import { createYearCalendarViewModel } from '$lib/calendar/year-calendar';
  import type { YearCalendarDay } from '$lib/calendar/year-calendar';
  import { dayAnnotationsStore } from '$lib/stores/day-annotations.store';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import type { DayAnnotation } from '$lib/types/domain';

  const activeRoute = '/app/calendar';
  let familyUnsubscribe: Unsubscriber | undefined;
  let currentFamilyState: FamilyState | undefined;
  let loadedYearKey: string | null = null;
  let selectedDateKey: string | undefined;

  const demoAnnotations: DayAnnotation[] = [
    {
      id: 'demo_new_year',
      family: 'demo',
      kind: 'public_holiday',
      title: 'Новый год',
      month: 1,
      day: 1,
      year: 2026,
      recurrence: 'one_time',
      color: 'gray',
      tone: 'system',
      visibility: 'family',
      source: 'nager_date',
      readonly: true,
      countryCode: 'RU'
    },
    {
      id: 'demo_misha_birthday',
      family: 'demo',
      kind: 'birthday',
      title: 'День рождения Миши',
      month: 3,
      day: 12,
      year: 2017,
      recurrence: 'yearly',
      color: 'green',
      tone: 'positive',
      visibility: 'family',
      source: 'family_member',
      readonly: false,
      linkedMember: 'member_misha',
      personName: 'Миша'
    },
    {
      id: 'demo_vladimir_birthday',
      family: 'demo',
      kind: 'birthday',
      title: 'День рождения Владимира',
      month: 6,
      day: 18,
      recurrence: 'yearly',
      color: 'blue',
      tone: 'positive',
      visibility: 'family',
      source: 'manual',
      readonly: false,
      personName: 'Владимир',
      personRelation: 'коллега',
      personContact: '+7 999 000-00-00'
    },
    {
      id: 'demo_memorial',
      family: 'demo',
      kind: 'memorial',
      title: 'Памятный день',
      month: 9,
      day: 4,
      recurrence: 'yearly',
      color: 'gray',
      tone: 'memorial',
      visibility: 'family',
      source: 'manual',
      readonly: false
    }
  ];

  $: selectedYear = $dayAnnotationsStore.selectedYear;
  $: calendarAnnotations =
    $dayAnnotationsStore.projectedAnnotations.length > 0
      ? $dayAnnotationsStore.projectedAnnotations
      : demoAnnotations;
  $: yearModel = createYearCalendarViewModel(selectedYear, calendarAnnotations);
  $: selectedDay = selectedDateKey ? yearModel.daysByDate.get(selectedDateKey) : undefined;
  $: selectedTodayHref = selectedDay
    ? buildTodayCalendarHref({ dateKey: selectedDay.dateKey, view: 'day' })
    : undefined;

  async function loadAnnotationsFromFamilyState(familyState: FamilyState | undefined) {
    if (!familyState || familyState.status !== 'ready') return;

    const context = getActiveFamilyContext(familyState);
    if (!context) return;

    const selectedYear = get(dayAnnotationsStore).selectedYear;
    const yearKey = `${context.familyId}:${context.memberId}:${selectedYear}`;
    if (loadedYearKey === yearKey) return;
    loadedYearKey = yearKey;

    try {
      await dayAnnotationsStore.loadYear(context);
    } catch (error) {
      console.warn('Failed to load Calendar day annotations from PocketBase, keeping demo year.', error);
    }
  }

  function goPreviousYear(): void {
    dayAnnotationsStore.goPreviousYear();
    selectedDateKey = undefined;
    void loadAnnotationsFromFamilyState(currentFamilyState);
  }

  function goNextYear(): void {
    dayAnnotationsStore.goNextYear();
    selectedDateKey = undefined;
    void loadAnnotationsFromFamilyState(currentFamilyState);
  }

  function selectDay(day: YearCalendarDay): void {
    selectedDateKey = day.dateKey;
  }

  function closeDayDetail(): void {
    selectedDateKey = undefined;
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((familyState) => {
      currentFamilyState = familyState;
      void loadAnnotationsFromFamilyState(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="calendar-title-mobile" calendar>
  <header class="top-row">
    <h1 id="calendar-title-mobile">Календарь</h1>
    <button class="icon-button" type="button" aria-label="Открыть уведомления">
      <Bell size={23} strokeWidth={2.2} aria-hidden="true" />
      <span class="notification-dot" aria-hidden="true"></span>
    </button>
  </header>

  <section class="calendar-year-toolbar" aria-label="Навигация по году">
    <button type="button" aria-label="Предыдущий год" on:click={goPreviousYear}>
      <ChevronLeft size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
    <div>
      <span>Годовой обзор</span>
      <strong>{selectedYear}</strong>
    </div>
    <button type="button" aria-label="Следующий год" on:click={goNextYear}>
      <ChevronRight size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </section>

  <YearCalendar model={yearModel} compact {selectedDateKey} onselectDay={selectDay} />
  <DayDetailSheet
    day={selectedDay}
    todayHref={selectedTodayHref}
    titleId="day-detail-title-mobile"
    onclose={closeDayDetail}
  />
</MobileShell>

<FloatingCreateButton />

<DesktopShell {activeRoute} labelledBy="calendar-title-desktop">
  <div class="desktop-header">
    <div>
      <h1 id="calendar-title-desktop">Календарь</h1>
      <p class="offline-note">Годовой обзор, праздники, дни рождения и особые даты семьи.</p>
    </div>
    <div class="calendar-year-actions">
      <button type="button" aria-label="Предыдущий год" on:click={goPreviousYear}>
        <ChevronLeft size={19} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <strong>{selectedYear}</strong>
      <button type="button" aria-label="Следующий год" on:click={goNextYear}>
        <ChevronRight size={19} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
    <Button variant="primary">+ Особая дата</Button>
  </div>

  <YearCalendar model={yearModel} {selectedDateKey} onselectDay={selectDay} />

  <svelte:fragment slot="aside">
    <DayDetailSheet
      day={selectedDay}
      todayHref={selectedTodayHref}
      titleId="day-detail-title-desktop"
      onclose={closeDayDetail}
    />

    <section class="calendar-legend" aria-labelledby="calendar-legend-title">
      <h2 id="calendar-legend-title">Слой дат</h2>
      <p>Праздники, дни рождения и особые даты показываются как информация о дне, отдельно от дел и поручений.</p>
      <div class="calendar-legend__items">
        <span><i class="year-marker year-marker--birthday"></i> День рождения</span>
        <span><i class="year-marker year-marker--public_holiday"></i> Праздник</span>
        <span><i class="year-marker year-marker--family_date"></i> Особая дата</span>
        <span><i class="year-marker year-marker--memorial"></i> Памятный день</span>
      </div>
    </section>
  </svelte:fragment>
</DesktopShell>

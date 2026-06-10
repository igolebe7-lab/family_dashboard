<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import MemberAvatarRow from '$lib/components/family/MemberAvatarRow.svelte';
  import AttentionPanel from '$lib/components/today/AttentionPanel.svelte';
  import DesktopHeader from '$lib/components/today/DesktopHeader.svelte';
  import QuickActions from '$lib/components/today/QuickActions.svelte';
  import TodayHeader from '$lib/components/today/TodayHeader.svelte';
  import TodayAllDayStrip from '$lib/components/today/TodayAllDayStrip.svelte';
  import TodayTimeline from '$lib/components/today/TodayTimeline.svelte';
  import TodayWeekBoard from '$lib/components/today/TodayWeekBoard.svelte';
  import { DEMO_DAY_ANNOTATIONS } from '$lib/calendar/demo-day-annotations';
  import { loadPublicHolidaysForYears, mergeDayAnnotations } from '$lib/calendar/holiday-sync';
  import { parseTodayCalendarSearch } from '$lib/calendar/today-navigation';
  import { getIcon } from '$lib/design/icon-registry';
  import { calendarStore } from '$lib/stores/calendar.store';
  import { dayAnnotationsStore } from '$lib/stores/day-annotations.store';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import { createTodayAllDayInfoViewModel } from '$lib/today/today-all-day';
  import { loadTodayViewModelFromOccurrences } from '$lib/today/today-data';
  import {
    createTodayViewModel,
    formatDateKey,
    type TodayViewModel
  } from '$lib/today/today-view-model';
  import type { DayAnnotation } from '$lib/types/domain';

  const fixtureMode =
    browser && new URLSearchParams(window.location.search).get('fixture') === 'desktop-reference';
  const navigationState =
    browser && !fixtureMode ? parseTodayCalendarSearch(new URLSearchParams(window.location.search)) : null;
  const selectedTodayDate = navigationState?.date ?? new Date();
  const selectedCalendarView = navigationState?.view ?? 'week';
  const selectedTodayDateKey = navigationState?.dateKey ?? formatDateKey(selectedTodayDate);
  const activeRoute = '/app/today';

  let today: TodayViewModel = createTodayViewModel(
    fixtureMode ? { fixture: 'desktop-reference' } : selectedTodayDate
  );
  let familyUnsubscribe: Unsubscriber | undefined;
  let loadedContextKey: string | null = null;
  let loadedAnnotationsKey: string | null = null;
  let publicHolidayAnnotations: DayAnnotation[] = [];

  $: loadedTodayAnnotations = mergeDayAnnotations(
    $dayAnnotationsStore.projectedAnnotations,
    publicHolidayAnnotations
  );
  $: todayAnnotations =
    loadedTodayAnnotations.length > 0 ? loadedTodayAnnotations : DEMO_DAY_ANNOTATIONS;
  $: allDayInfo = createTodayAllDayInfoViewModel({
    date: selectedTodayDate,
    annotations: todayAnnotations
  });

  async function loadTodayFromFamilyState(familyState: FamilyState) {
    const context = getActiveFamilyContext(familyState);
    if (!context) return;

    const contextKey = `${context.familyId}:${context.memberId}:${today.weekLabel}`;
    if (loadedContextKey === contextKey) return;
    loadedContextKey = contextKey;

    try {
      today = await loadTodayViewModelFromOccurrences(context, {
        date: selectedTodayDate,
        members: familyState.members
      });
    } catch (error) {
      console.warn('Failed to load Today data from PocketBase, keeping demo view model.', error);
    }
  }

  async function loadDayAnnotationsFromFamilyState(familyState: FamilyState) {
    const context = getActiveFamilyContext(familyState);
    if (!context) return;

    const selectedYear = selectedTodayDate.getFullYear();
    const annotationsKey = `${context.familyId}:${context.memberId}:${selectedYear}`;
    if (loadedAnnotationsKey === annotationsKey) return;
    loadedAnnotationsKey = annotationsKey;
    dayAnnotationsStore.setYear(selectedYear);

    try {
      await dayAnnotationsStore.loadYear(context);
    } catch (error) {
      console.warn('Failed to load Today day annotations from PocketBase, keeping cached holiday layer.', error);
    }

    try {
      publicHolidayAnnotations = await loadPublicHolidaysForYears({
        countryCode: 'RU',
        familyId: context.familyId,
        storage: localStorage,
        years: [selectedYear, selectedYear + 1]
      });
    } catch (error) {
      console.warn('Failed to load Today public holidays, keeping local family annotations.', error);
    }
  }

  onMount(() => {
    if (fixtureMode) return;

    if (navigationState) {
      calendarStore.setSelectedDate(navigationState.date);
      calendarStore.setView(navigationState.view);
    }

    familyUnsubscribe = familyStore.subscribe((familyState) => {
      if (familyState.status !== 'ready') return;
      void loadTodayFromFamilyState(familyState);
      void loadDayAnnotationsFromFamilyState(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="today-title-mobile">
  <TodayHeader
    titleId="today-title-mobile"
    greeting={today.greeting}
    dateLabel={today.dateLabel}
    notificationCount={today.attentionCount}
  />

  <MemberAvatarRow members={today.familyMembers} />
  <section class="today-mobile-surface" aria-label="Сегодня, внимание и быстрые действия">
    <TodayAllDayStrip model={allDayInfo} labelledBy="today-all-day-title-mobile" />
    <TodayTimeline items={today.timelineItems} labelledBy="today-timeline-title-mobile" />
    <AttentionPanel items={today.attentionItems} labelledBy="attention-title-mobile" />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-mobile" />
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="today-title-desktop">
  <DesktopHeader
    titleId="today-title-desktop"
    greeting={today.greeting}
    dateLabel={today.dateLabel}
    notificationCount={today.attentionCount}
  />

  <TodayAllDayStrip model={allDayInfo} labelledBy="today-all-day-title-desktop" />

  <TodayWeekBoard
    labelledBy="today-week-title-desktop"
    initialView={selectedCalendarView}
    selectedDate={selectedTodayDate}
    selectedDateKey={selectedTodayDateKey}
    weekLabel={today.weekLabel}
    days={today.weekDays}
    times={today.weekTimes}
    events={today.weekEvents}
    annotations={todayAnnotations}
  />

  <svelte:fragment slot="aside">
    <AttentionPanel items={today.attentionItems} labelledBy="attention-title-desktop" />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-desktop" />

    <section class="today-feed" aria-labelledby="today-feed-title">
      <div class="section-title-row">
        <div>
          <p class="section-kicker">Последние изменения</p>
          <h2 id="today-feed-title">Семейная лента</h2>
        </div>
      </div>

      <div class="today-feed__list">
        {#each today.feedItems as item (item.id)}
          {@const Icon = getIcon(item.icon)}
          <article class={`today-feed__item today-feed__item--${item.color}`}>
            <span class="today-feed__icon" aria-hidden="true">
              <svelte:component this={Icon} size={17} strokeWidth={2.35} />
            </span>
            <p><strong>{item.actor}</strong> {item.body}</p>
            <time>{item.timeLabel}</time>
          </article>
        {/each}
      </div>

      <a class="today-feed__link" href="/app/feed">Открыть всю ленту ›</a>
    </section>
  </svelte:fragment>
</DesktopShell>

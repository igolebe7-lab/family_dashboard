<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import ComposerSheet from '$lib/components/composer/ComposerSheet.svelte';
  import ActiveProfileSwitcher from '$lib/components/family/ActiveProfileSwitcher.svelte';
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
  import { getItem } from '$lib/api/items.api';
  import type { ComposerKind } from '$lib/composer/composer-form';
  import { getIcon } from '$lib/design/icon-registry';
  import { calendarStore } from '$lib/stores/calendar.store';
  import { dayAnnotationsStore } from '$lib/stores/day-annotations.store';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import { sessionStore, type SessionState } from '$lib/stores/session.store';
  import { createTodayAllDayInfoViewModel } from '$lib/today/today-all-day';
  import { loadTodayViewModelFromOccurrences } from '$lib/today/today-data';
  import {
    createTodayViewModel,
    formatDateKey,
    type TodayAllDayItem,
    type TodayTimelineItem,
    type TodayViewModel
  } from '$lib/today/today-view-model';
  import type { DayAnnotation } from '$lib/types/domain';
  import type { FamilyMember } from '$lib/types/domain';

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
  let sessionUnsubscribe: Unsubscriber | undefined;
  let currentFamilyState: FamilyState | undefined;
  let currentSessionState: SessionState | undefined;
  let loadedContextKey: string | null = null;
  let loadedAnnotationsKey: string | null = null;
  let publicHolidayAnnotations: DayAnnotation[] = [];
  let composerOpen = false;
  let composerKind: ComposerKind = 'event';

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
  $: canSwitchActiveProfile = canAuthenticatedAdultSwitchProfiles(
    currentFamilyState?.members ?? [],
    currentSessionState?.user?.id
  );

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

  function openComposer(kind: ComposerKind): void {
    composerKind = kind;
    composerOpen = true;
  }

  function setActiveMember(member: FamilyMember): void {
    familyStore.setActiveMember(member);
    loadedContextKey = null;
    if (currentFamilyState) {
      void loadTodayFromFamilyState({
        ...currentFamilyState,
        activeMember: member
      });
    }
  }

  function canAuthenticatedAdultSwitchProfiles(
    members: FamilyMember[],
    currentUserId: string | undefined
  ): boolean {
    if (!currentUserId || members.length <= 1) return false;

    return members.some(
      (member) =>
        member.user === currentUserId &&
        (member.role === 'owner' || member.role === 'parent' || member.role === 'adult')
    );
  }

  async function refreshTodayAfterCreate(): Promise<void> {
    if (!currentFamilyState) return;
    loadedContextKey = null;
    await loadTodayFromFamilyState(currentFamilyState);
  }

  async function loadTimelineDetails(item: TodayTimelineItem | TodayAllDayItem) {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context) return {};

    const fullItem = await getItem(item.itemId, context);
    const participantIds =
      fullItem.kind === 'event'
        ? fullItem.participants
        : fullItem.assignees.length > 0
          ? fullItem.assignees
          : fullItem.owner
            ? [fullItem.owner]
            : [];
    const participantNames = participantIds
      .map((memberId) => currentFamilyState?.members.find((member) => member.id === memberId)?.displayName)
      .filter((name): name is string => Boolean(name));

    return {
      description: fullItem.description,
      locationText: fullItem.locationText,
      participantNames:
        participantNames.length === currentFamilyState?.members.length ? ['Вся семья'] : participantNames
    };
  }

  onMount(() => {
    if (fixtureMode) return;

    if (navigationState) {
      calendarStore.setSelectedDate(navigationState.date);
      calendarStore.setView(navigationState.view);
    }

    familyUnsubscribe = familyStore.subscribe((familyState) => {
      currentFamilyState = familyState;
      if (familyState.status !== 'ready') return;
      void loadTodayFromFamilyState(familyState);
      void loadDayAnnotationsFromFamilyState(familyState);
    });
    sessionUnsubscribe = sessionStore.subscribe((sessionState) => {
      currentSessionState = sessionState;
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
    sessionUnsubscribe?.();
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
  <ActiveProfileSwitcher
    members={currentFamilyState?.members ?? []}
    activeMember={currentFamilyState?.activeMember ?? null}
    canSwitch={canSwitchActiveProfile}
    onchange={setActiveMember}
  />
  <section class="today-mobile-surface" aria-label="Сегодня, внимание и быстрые действия">
    <TodayAllDayStrip model={allDayInfo} labelledBy="today-all-day-title-mobile" />
    <TodayTimeline
      allDayItems={today.allDayItems}
      items={today.timelineItems}
      labelledBy="today-timeline-title-mobile"
      loadDetails={loadTimelineDetails}
    />
    <AttentionPanel items={today.attentionItems} labelledBy="attention-title-mobile" />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-mobile" onselect={openComposer} />
  </section>

  {#if composerOpen}
    <ComposerSheet
      activeKind={composerKind}
      context={currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null}
      members={currentFamilyState?.members ?? []}
      selectedDate={selectedTodayDate}
      timezone={currentFamilyState?.activeFamily?.timezone}
      titleId="composer-title-mobile"
      onclose={() => (composerOpen = false)}
      oncreated={refreshTodayAfterCreate}
    />
  {/if}
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
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-desktop" onselect={openComposer} />

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

  {#if composerOpen}
    <ComposerSheet
      activeKind={composerKind}
      context={currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null}
      members={currentFamilyState?.members ?? []}
      selectedDate={selectedTodayDate}
      timezone={currentFamilyState?.activeFamily?.timezone}
      titleId="composer-title-desktop"
      onclose={() => (composerOpen = false)}
      oncreated={refreshTodayAfterCreate}
    />
  {/if}
</DesktopShell>

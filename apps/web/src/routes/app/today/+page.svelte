<script lang="ts">
  import { browser, dev } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
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
  import { loadPublicHolidaysForYears, mergeDayAnnotations } from '$lib/calendar/holiday-sync';
  import { buildTodayCalendarHref, parseTodayCalendarSearch, type TodayNavigationView } from '$lib/calendar/today-navigation';
  import { getItem } from '$lib/api/items.api';
  import { approveOccurrence, markOccurrenceDone, rejectOccurrence } from '$lib/api/occurrences.api';
  import type { ComposerKind } from '$lib/composer/composer-form';
  import { getIcon } from '$lib/design/icon-registry';
  import { createDayAnnotationsStore } from '$lib/stores/day-annotations.store';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import { createRealtimeStore } from '$lib/stores/realtime.store';
  import { sessionStore } from '$lib/stores/session.store';
  import { itemDetailsStore } from '$lib/stores/item-details.store';
  import { createTodayAllDayInfoViewModel } from '$lib/today/today-all-day';
  import { getTodayOccurrenceRange } from '$lib/today/today-data';
  import { createTodayState } from '$lib/today/today-state';
  import { createTodayViewModel, formatDateKey, type TodayAttentionItem, type TodayAllDayItem, type TodayTimelineItem } from '$lib/today/today-view-model';
  import type { DayAnnotation, FamilyMember } from '$lib/types/domain';

  const activeRoute = '/app/today';
  const initialDate = new Date();
  const todayState = createTodayState();
  const dayAnnotationsStore = createDayAnnotationsStore();
  let routeRealtimeStore = createRealtimeStore();
  let mounted = false;
  let generation = 0;
  let loadedKey: string | null = null;
  let publicHolidayAnnotations: DayAnnotation[] = [];
  let holidayError: string | null = null;
  let realtimeError: string | null = null;
  let composerOpen = false;
  let composerKind: ComposerKind = 'event';
  let busyOccurrenceId: string | null = null;
  let actionMessage: string | null = null;
  let actionError: string | null = null;

  $: fixtureMode = dev && $page.url.searchParams.get('fixture') === 'desktop-reference';
  $: navigationState = parseTodayCalendarSearch($page.url.searchParams);
  $: selectedTodayDate = fixtureMode ? new Date(2024, 4, 24) : navigationState?.date ?? initialDate;
  $: selectedCalendarView = navigationState?.view ?? 'week';
  $: selectedTodayDateKey = formatDateKey(selectedTodayDate);
  $: currentFamilyState = $familyStore;
  $: today = fixtureMode ? createTodayViewModel({ fixture: 'desktop-reference' }) : $todayState.model;
  $: todayAnnotations = mergeDayAnnotations($dayAnnotationsStore.projectedAnnotations, publicHolidayAnnotations);
  $: allDayInfo = createTodayAllDayInfoViewModel({ date: selectedTodayDate, annotations: todayAnnotations });
  $: canSwitchActiveProfile = canAuthenticatedAdultSwitchProfiles(currentFamilyState.members, $sessionStore.user?.id);
  $: notificationCount = fixtureMode ? 0 : $todayState.notificationCount;
  $: if (mounted) syncPage(currentFamilyState, selectedTodayDate, selectedCalendarView, fixtureMode);
  $: loadErrors = [$todayState.error, $dayAnnotationsStore.error, holidayError, $todayState.notificationError, realtimeError].filter(Boolean);

  function syncPage(familyState: FamilyState, date: Date, view: TodayNavigationView, fixture: boolean) {
    const context = familyState.status === 'ready' && !fixture ? getActiveFamilyContext(familyState) : null;
    const key = JSON.stringify([context, formatDateKey(date), view, familyState.members]);
    if (key === loadedKey) return;
    loadedKey = key;
    const epoch = ++generation;
    routeRealtimeStore.stopAll();
    routeRealtimeStore = createRealtimeStore();
    dayAnnotationsStore.reset();
    todayState.reset(date);
    publicHolidayAnnotations = [];
    holidayError = null;
    realtimeError = null;
    actionError = null;
    actionMessage = null;
    busyOccurrenceId = null;
    composerOpen = false;
    if (!context) return;
    void todayState.load({ context, date, view, members: familyState.members });
    void loadAnnotations(epoch, context, date);
    void syncRealtime(epoch, context, date, view);
  }

  async function loadAnnotations(epoch: number, context: NonNullable<ReturnType<typeof getActiveFamilyContext>>, date: Date) {
    dayAnnotationsStore.setYear(date.getFullYear());
    const annotations = dayAnnotationsStore.loadYear(context).catch(() => {});
    try {
      const holidays = await loadPublicHolidaysForYears({
        countryCode: 'RU', familyId: context.familyId, storage: localStorage,
        years: [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]
      });
      if (epoch === generation) { publicHolidayAnnotations = holidays; holidayError = null; }
    } catch {
      if (epoch === generation) holidayError = 'Не удалось загрузить государственные праздники.';
    }
    await annotations;
  }

  async function syncRealtime(epoch: number, context: NonNullable<ReturnType<typeof getActiveFamilyContext>>, date: Date, view: TodayNavigationView) {
    const realtime = routeRealtimeStore;
    const guarded = (refresh: () => Promise<unknown>) => () => { if (epoch === generation) void refresh(); };
    await Promise.all([
      realtime.syncNotifications(context, guarded(todayState.refreshNotifications)),
      realtime.syncActivity(context, guarded(todayState.refreshActivity)),
      realtime.syncOccurrences(context, getTodayOccurrenceRange(date, view), guarded(todayState.refreshOccurrences))
    ].map(async (subscription) => {
      try { await subscription; }
      catch { if (epoch === generation) realtimeError = 'Обновления в реальном времени недоступны.'; }
      finally { if (epoch !== generation) realtime.stopAll(); }
    }));
  }

  function retryLoading() {
    loadedKey = null;
    syncPage(currentFamilyState, selectedTodayDate, selectedCalendarView, fixtureMode);
  }

  function navigateCalendar(date: Date, view: TodayNavigationView) {
    void goto(buildTodayCalendarHref({ dateKey: formatDateKey(date), view }), { noScroll: true, keepFocus: true });
  }

  function openComposer(kind: ComposerKind): void { composerKind = kind; composerOpen = true; }
  function setActiveMember(member: FamilyMember): void { familyStore.setActiveMember(member); }
  function canAuthenticatedAdultSwitchProfiles(members: FamilyMember[], userId: string | undefined): boolean {
    return Boolean(userId && members.length > 1 && members.some((member) =>
      member.user === userId && ['owner', 'parent', 'adult'].includes(member.role)));
  }
  async function refreshTodayAfterCreate(): Promise<void> { await todayState.refresh(); }

  async function runOccurrenceAction(
    occurrenceId: string | undefined,
    action: (id: string, context: NonNullable<ReturnType<typeof getActiveFamilyContext>>) => Promise<unknown>,
    successMessage: string
  ): Promise<void> {
    const context = getActiveFamilyContext(currentFamilyState);
    if (!context || !occurrenceId || busyOccurrenceId) return;
    const epoch = generation;
    busyOccurrenceId = occurrenceId;
    actionError = null;
    actionMessage = null;
    try {
      await action(occurrenceId, context);
      if (epoch !== generation) return;
      actionMessage = successMessage;
      await refreshTodayAfterCreate();
    } catch {
      if (epoch === generation) actionError = 'Не удалось обновить поручение. Проверьте подключение и права доступа.';
    } finally { if (epoch === generation) busyOccurrenceId = null; }
  }
  function completeAssignment(item: TodayTimelineItem) { return runOccurrenceAction(item.id, markOccurrenceDone, 'Отметили как готово.'); }
  function approveAssignment(item: TodayAttentionItem) { return runOccurrenceAction(item.occurrenceId, approveOccurrence, 'Поручение подтверждено.'); }
  function rejectAssignment(item: TodayAttentionItem) { return runOccurrenceAction(item.occurrenceId, rejectOccurrence, 'Поручение возвращено на доработку.'); }
  function openAttention(item: TodayAttentionItem) {
    if (item.itemId) itemDetailsStore.set(item.itemId);
    else if (item.actionKind === 'add_task') openComposer('task');
    else void goto('/app/assignments');
  }

  async function loadTimelineDetails(item: TodayTimelineItem | TodayAllDayItem) {
    const context = getActiveFamilyContext(currentFamilyState);
    if (!context) return {};
    const epoch = generation;
    const fullItem = await getItem(item.itemId, context);
    if (epoch !== generation) return {};
    const participantIds = fullItem.kind === 'event' ? fullItem.participants
      : fullItem.assignees.length ? fullItem.assignees : fullItem.owner ? [fullItem.owner] : [];
    return {
      description: fullItem.description, locationText: fullItem.locationText,
      participantNames: participantIds.map((id) => currentFamilyState.members.find((member) => member.id === id)?.displayName)
        .filter((name): name is string => Boolean(name))
    };
  }

  onMount(() => { mounted = browser; });
  onDestroy(() => {
    mounted = false;
    generation++;
    todayState.reset();
    dayAnnotationsStore.reset();
    routeRealtimeStore.stopAll();
  });
</script>

<MobileShell {activeRoute} labelledBy="today-title-mobile">
  <TodayHeader
    titleId="today-title-mobile"
    greeting={today.greeting}
    dateLabel={today.dateLabel}
    {notificationCount}
  />

  <MemberAvatarRow members={today.familyMembers} />
  <ActiveProfileSwitcher
    members={currentFamilyState?.members ?? []}
    activeMember={currentFamilyState?.activeMember ?? null}
    canSwitch={canSwitchActiveProfile}
    onchange={setActiveMember}
  />
  <section class="today-mobile-surface" aria-label="Сегодня, внимание и быстрые действия">
    {#if !fixtureMode && $todayState.status === 'loading'}<p role="status">Загружаем расписание…</p>{/if}
    {#if loadErrors.length > 0}
      <div role="alert"><p>{loadErrors.join(' ')}</p><button class="button" type="button" on:click={retryLoading}>Повторить загрузку</button></div>
    {/if}
    <TodayAllDayStrip model={allDayInfo} labelledBy="today-all-day-title-mobile" />
    {#if selectedCalendarView === 'month'}
      <TodayWeekBoard mobile
        contextKey={`${currentFamilyState.activeFamily?.id ?? ''}:${currentFamilyState.activeMember?.id ?? ''}`}
        onnavigate={navigateCalendar} labelledBy="today-month-title-mobile"
        initialView="month" selectedDate={selectedTodayDate} selectedDateKey={selectedTodayDateKey}
        weekLabel={today.weekLabel} events={today.weekEvents} annotations={todayAnnotations} />
    {:else}
    <div class="today-week-toolbar__view" aria-label="Вид календаря">
      <button type="button" aria-pressed="true" on:click={() => navigateCalendar(selectedTodayDate, 'day')}>День</button>
      <button type="button" aria-pressed="false" on:click={() => navigateCalendar(selectedTodayDate, 'month')}>Месяц</button>
    </div>
    {#key generation}
    <TodayTimeline
      loading={!fixtureMode && $todayState.status === 'loading'}
      error={$todayState.error}
      title={selectedTodayDateKey === formatDateKey(new Date()) ? 'Сегодня' : 'Расписание на день'}
      allDayItems={today.allDayItems}
      items={today.timelineItems}
      labelledBy="today-timeline-title-mobile"
      loadDetails={loadTimelineDetails}
      {busyOccurrenceId}
      oncompleteAssignment={completeAssignment}
    />
    {/key}
    {/if}
    {#if actionError}<p class="today-action-message today-action-message--error">{actionError}</p>{/if}
    {#if actionMessage}<p class="today-action-message">{actionMessage}</p>{/if}
    <AttentionPanel
      items={today.attentionItems}
      labelledBy="attention-title-mobile"
      busyItemId={busyOccurrenceId ? `attention-approval-${busyOccurrenceId}` : null}
      onapprove={approveAssignment}
      onreject={rejectAssignment}
      onopen={openAttention}
    />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-mobile" onselect={openComposer} />
  </section>

</MobileShell>

<DesktopShell {activeRoute} labelledBy="today-title-desktop">
    <DesktopHeader
    oncreate={() => openComposer('event')}
    titleId="today-title-desktop"
    greeting={today.greeting}
    dateLabel={today.dateLabel}
      {notificationCount}
  />

  <TodayAllDayStrip model={allDayInfo} labelledBy="today-all-day-title-desktop" />

  {#if !fixtureMode && $todayState.status === 'loading'}<p role="status">Загружаем расписание…</p>{/if}
  {#if loadErrors.length > 0}
    <div role="alert"><p>{loadErrors.join(' ')}</p><button class="button" type="button" on:click={retryLoading}>Повторить загрузку</button></div>
  {/if}
  <TodayWeekBoard
    contextKey={`${currentFamilyState.activeFamily?.id ?? ''}:${currentFamilyState.activeMember?.id ?? ''}`}
    onnavigate={navigateCalendar}
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
    {#if actionError}<p class="today-action-message today-action-message--error">{actionError}</p>{/if}
    {#if actionMessage}<p class="today-action-message">{actionMessage}</p>{/if}
    <AttentionPanel
      items={today.attentionItems}
      labelledBy="attention-title-desktop"
      busyItemId={busyOccurrenceId ? `attention-approval-${busyOccurrenceId}` : null}
      onapprove={approveAssignment}
      onreject={rejectAssignment}
      onopen={openAttention}
    />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-desktop" onselect={openComposer} />

    <section class="today-feed" aria-labelledby="today-feed-title">
      <div class="section-title-row">
        <div>
          <p class="section-kicker">Последние изменения</p>
          <h2 id="today-feed-title">Семейная лента</h2>
        </div>
      </div>

      <div class="today-feed__list">
        {#if $todayState.feedError}
          <p role="alert">{$todayState.feedError}</p><button class="button" type="button" on:click={() => todayState.refreshActivity()}>Повторить</button>
        {:else if $todayState.feedItems.length === 0 && !fixtureMode}
          <p>Пока нет изменений.</p>
        {/if}
        {#each (fixtureMode ? today.feedItems : $todayState.feedItems) as item (item.id)}
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

{#if composerOpen}
    <ComposerSheet
      activeKind={composerKind}
      context={currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null}
      members={currentFamilyState?.members ?? []}
      selectedDate={selectedTodayDate}
      timezone={currentFamilyState?.activeFamily?.timezone}
      titleId="composer-title"
      onclose={() => (composerOpen = false)}
      oncreated={refreshTodayAfterCreate}
    />
{/if}

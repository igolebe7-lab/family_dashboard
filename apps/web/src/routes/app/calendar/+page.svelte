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
  import SpecialDateForm from '$lib/components/calendar/SpecialDateForm.svelte';
  import YearCalendar from '$lib/components/calendar/YearCalendar.svelte';
  import ComposerSheet from '$lib/components/composer/ComposerSheet.svelte';
  import {
    createDayAnnotation,
    deleteDayAnnotation,
    updateDayAnnotation,
    type DayAnnotationInput
  } from '$lib/api/day-annotations.api';
  import { DEMO_DAY_ANNOTATIONS } from '$lib/calendar/demo-day-annotations';
  import { loadPublicHolidaysForYears, mergeDayAnnotations } from '$lib/calendar/holiday-sync';
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import type { ComposerKind } from '$lib/composer/composer-form';
  import { createYearCalendarViewModel } from '$lib/calendar/year-calendar';
  import type { YearCalendarDay, YearCalendarMonth } from '$lib/calendar/year-calendar';
  import { dayAnnotationsStore } from '$lib/stores/day-annotations.store';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import type { DayAnnotation } from '$lib/types/domain';

  const activeRoute = '/app/calendar';
  type SpecialDateFormMode = 'closed' | 'create' | 'edit';
  let familyUnsubscribe: Unsubscriber | undefined;
  let currentFamilyState: FamilyState | undefined;
  let loadedYearKey: string | null = null;
  let selectedDateKey: string | undefined;
  let formMode: SpecialDateFormMode = 'closed';
  let editingAnnotation: DayAnnotation | undefined;
  let formError: string | null = null;
  let formSaving = false;
  let publicHolidayAnnotations: DayAnnotation[] = [];
  let composerOpen = false;
  let composerKind: ComposerKind = 'event';

  $: selectedYear = $dayAnnotationsStore.selectedYear;
  $: loadedCalendarAnnotations = mergeDayAnnotations(
    $dayAnnotationsStore.projectedAnnotations,
    publicHolidayAnnotations
  );
  $: calendarAnnotations =
    loadedCalendarAnnotations.length > 0 ? loadedCalendarAnnotations : DEMO_DAY_ANNOTATIONS;
  $: yearModel = createYearCalendarViewModel(selectedYear, calendarAnnotations);
  $: selectedDay = selectedDateKey ? yearModel.daysByDate.get(selectedDateKey) : undefined;
  $: selectedTodayHref = selectedDay
    ? buildTodayCalendarHref({ dateKey: selectedDay.dateKey, view: 'day' })
    : undefined;
  $: selectedDateForForm = selectedDay
    ? createDateFromDateKey(selectedDay.dateKey)
    : createDefaultCalendarDate(selectedYear);
  $: isFormOpen = formMode !== 'closed';

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
      console.warn('Failed to load Calendar day annotations from PocketBase, keeping cached holiday layer.', error);
    }

    try {
      publicHolidayAnnotations = await loadPublicHolidaysForYears({
        countryCode: 'RU',
        familyId: context.familyId,
        storage: localStorage,
        years: [selectedYear, selectedYear + 1]
      });
    } catch (error) {
      console.warn('Failed to load Calendar public holidays, keeping local family annotations.', error);
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

  function getMonthHref(month: YearCalendarMonth): string {
    const monthValue = String(month.month).padStart(2, '0');
    return buildTodayCalendarHref({ dateKey: `${selectedYear}-${monthValue}-01`, view: 'month' });
  }

  function closeDayDetail(): void {
    selectedDateKey = undefined;
  }

  function openCreateSpecialDate(): void {
    editingAnnotation = undefined;
    formError = null;
    formMode = 'create';
  }

  function openComposer(kind: ComposerKind = 'event'): void {
    composerKind = kind;
    composerOpen = true;
  }

  function openEditSpecialDate(annotationId: string): void {
    const annotation = calendarAnnotations.find((item) => item.id === annotationId);
    if (!annotation || annotation.readonly) return;

    editingAnnotation = annotation;
    formError = null;
    formMode = 'edit';
  }

  function closeSpecialDateForm(): void {
    formMode = 'closed';
    editingAnnotation = undefined;
    formError = null;
  }

  async function saveSpecialDate(input: DayAnnotationInput): Promise<void> {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context) {
      formError = 'Сначала подключите семью, затем можно будет сохранять особые даты.';
      return;
    }

    formSaving = true;
    formError = null;

    try {
      if (editingAnnotation) {
        await updateDayAnnotation(editingAnnotation.id, input, context);
      } else {
        await createDayAnnotation(input, context);
      }

      if (input.year) dayAnnotationsStore.setYear(input.year);
      loadedYearKey = null;
      await loadAnnotationsFromFamilyState(currentFamilyState);
      closeSpecialDateForm();
    } catch (error) {
      formError = 'Не удалось сохранить дату. Проверьте поля или подключение к серверу.';
      console.warn('Failed to save special date.', error);
    } finally {
      formSaving = false;
    }
  }

  async function removeSpecialDate(): Promise<void> {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context || !editingAnnotation) {
      formError = 'Не удалось удалить дату без активной семьи.';
      return;
    }

    formSaving = true;
    formError = null;

    try {
      await deleteDayAnnotation(editingAnnotation.id, context);
      loadedYearKey = null;
      await loadAnnotationsFromFamilyState(currentFamilyState);
      closeSpecialDateForm();
    } catch (error) {
      formError = 'Не удалось удалить дату. Попробуйте ещё раз.';
      console.warn('Failed to delete special date.', error);
    } finally {
      formSaving = false;
    }
  }

  function createDateFromDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function createDefaultCalendarDate(year: number): Date {
    const today = new Date();
    if (today.getFullYear() === year) return today;
    return new Date(year, 0, 1);
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
  <div class="calendar-mobile-sticky">
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

    <button class="button button--primary calendar-special-date-button" type="button" on:click={openCreateSpecialDate}>
      + Особая дата
    </button>
  </div>

  <YearCalendar model={yearModel} compact {selectedDateKey} onselectDay={selectDay} monthHref={getMonthHref} />
  <DayDetailSheet
    day={selectedDay}
    onedit={openEditSpecialDate}
    todayHref={selectedTodayHref}
    titleId="day-detail-title-mobile"
    onclose={closeDayDetail}
  />
  {#if isFormOpen}
    <SpecialDateForm
      annotation={editingAnnotation}
      error={formError}
      saving={formSaving}
      selectedDate={selectedDateForForm}
      titleId="special-date-form-title-mobile"
      oncancel={closeSpecialDateForm}
      ondelete={removeSpecialDate}
      onsave={saveSpecialDate}
    />
  {/if}
  {#if composerOpen}
    <ComposerSheet
      activeKind={composerKind}
      context={currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null}
      members={currentFamilyState?.members ?? []}
      selectedDate={selectedDateForForm}
      timezone={currentFamilyState?.activeFamily?.timezone}
      titleId="calendar-composer-title-mobile"
      onclose={() => (composerOpen = false)}
    />
  {/if}
</MobileShell>

<FloatingCreateButton onclick={() => openComposer('event')} />

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
    <button class="button button--primary desktop-calendar-create" type="button" on:click={openCreateSpecialDate}>
      + Особая дата
    </button>
  </div>

  <YearCalendar model={yearModel} {selectedDateKey} onselectDay={selectDay} monthHref={getMonthHref} />

  <svelte:fragment slot="aside">
    <DayDetailSheet
      day={selectedDay}
      onedit={openEditSpecialDate}
      todayHref={selectedTodayHref}
      titleId="day-detail-title-desktop"
      onclose={closeDayDetail}
    />

    {#if isFormOpen}
      <SpecialDateForm
        annotation={editingAnnotation}
        error={formError}
        saving={formSaving}
        selectedDate={selectedDateForForm}
        titleId="special-date-form-title-desktop"
        oncancel={closeSpecialDateForm}
        ondelete={removeSpecialDate}
        onsave={saveSpecialDate}
      />
    {/if}
    {#if composerOpen}
      <ComposerSheet
        activeKind={composerKind}
        context={currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null}
        members={currentFamilyState?.members ?? []}
        selectedDate={selectedDateForForm}
        timezone={currentFamilyState?.activeFamily?.timezone}
        titleId="calendar-composer-title-desktop"
        onclose={() => (composerOpen = false)}
      />
    {/if}

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

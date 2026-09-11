<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import type { ActiveFamilyContext } from '$lib/api/pocketbase';
  import { listEventSchedule, updateScheduledOccurrence } from '$lib/api/schedule.api';
  import type { Item, ItemOccurrence } from '$lib/types/domain';
  import { createScheduleFormValues, createScheduleInput, type ScheduleFormValues } from '$lib/composer/schedule-form';

  export let item: Item;
  export let context: ActiveFamilyContext;
  export let canEdit = false;
  let occurrences: ItemOccurrence[] = [];
  let loading = true;
  let loadError = '';
  let saveError = '';
  let message = '';
  let saving = false;
  let editingId = '';
  let values: ScheduleFormValues | null = null;
  let editor: HTMLFormElement;
  let trigger: HTMLButtonElement | undefined;
  let generation = 0;
  let showPast = false;
  let now = Date.now();
  $: load(item.id, context.familyId, context.memberId);
  $: visibleOccurrences = occurrences.filter((occurrence) => showPast || Date.parse(occurrence.endAt || occurrence.startAt || '') >= now);
  $: if (!canEdit) { editingId = ''; values = null; }

  async function load(itemId: string, familyId: string, memberId: string) {
    const request = ++generation;
    loading = true; loadError = ''; saveError = ''; message = ''; editingId = ''; values = null; occurrences = []; saving = false;
    now = Date.now();
    try {
      const result = await listEventSchedule({ familyId, memberId }, itemId);
      if (request === generation) occurrences = result;
    } catch {
      if (request === generation) loadError = 'Не удалось загрузить расписание. Попробуйте ещё раз.';
    } finally {
      if (request === generation) loading = false;
    }
  }

  async function edit(occurrence: ItemOccurrence, button: HTMLButtonElement) {
    if (!canEdit || saving) return;
    saveError = ''; message = '';
    try {
      values = createScheduleFormValues(occurrence, item.timezone);
      editingId = occurrence.id; trigger = button;
      await tick();
      editor?.querySelector('input')?.focus();
    } catch { saveError = 'Проверьте дату и часовой пояс записи'; }
  }

  async function closeEditor() {
    editingId = ''; values = null; saveError = '';
    await tick();
    trigger?.focus();
  }

  async function save() {
    if (!canEdit || !values || !editingId || saving) return;
    const result = createScheduleInput(values, item.timezone);
    if (!result.ok) { saveError = result.error; return; }
    const request = generation;
    const id = editingId;
    saving = true; saveError = ''; message = '';
    try {
      const updated = await updateScheduledOccurrence(context, id, result.input);
      if (request !== generation) return;
      occurrences = occurrences.map((occurrence) => occurrence.id === id ? updated : occurrence)
        .sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
      message = 'Дата и время этого события изменены';
      await closeEditor();
    } catch {
      if (request === generation) saveError = 'Не удалось перенести событие. Проверьте подключение и права доступа.';
    } finally {
      if (request === generation) saving = false;
    }
  }

  function format(value?: string, allDay = false) {
    if (!value) return 'Без даты';
    return new Intl.DateTimeFormat('ru', {
      timeZone: item.timezone, day: 'numeric', month: 'long', year: 'numeric',
      ...(allDay ? {} : { hour: '2-digit', minute: '2-digit' })
    }).format(new Date(value));
  }
  onDestroy(() => { generation += 1; });
</script>

<section class="event-schedule" aria-label="Расписание события">
  <header class="schedule-heading"><h2>Ближайшие события</h2><span class="results-count">{item.timezone}</span></header>
  <label class="schedule-past"><input type="checkbox" bind:checked={showPast} />Показать прошедшие за месяц</label>
  {#if loading}<p role="status">Загружаем расписание…</p>
  {:else if loadError}<div role="alert"><p>{loadError}</p><button type="button" class="button button--soft" on:click={() => load(item.id, context.familyId, context.memberId)}>Повторить</button></div>
  {:else if !visibleOccurrences.length}<p class="results-count">На ближайшие 90 дней событий нет</p>
  {:else}
    <ul class="schedule-list">
      {#each visibleOccurrences as occurrence (occurrence.id)}
        <li>
          <div class="schedule-row">
            <div><p>{format(occurrence.startAt, occurrence.allDay)}</p><p class="results-count">{occurrence.allDay ? 'Весь день' : `до ${format(occurrence.endAt)}`}</p></div>
            {#if canEdit}<button type="button" class="button button--soft" disabled={saving} aria-label={`Перенести событие ${format(occurrence.startAt, occurrence.allDay)}`} on:click={(event) => edit(occurrence, event.currentTarget)}><CalendarClock size={18} aria-hidden="true" />Перенести</button>{/if}
          </div>
          {#if canEdit && editingId === occurrence.id && values}
            <form class="auth-form schedule-edit" bind:this={editor} on:submit|preventDefault={save}>
              <fieldset disabled={saving}>
                <legend>Дата и время этого события</legend>
                <div class="schedule-fields">
                  <label>Дата начала<input type="date" required bind:value={values.startDate} /></label>
                  {#if !values.allDay}<label>Время начала<input type="time" required bind:value={values.startTime} /></label>{/if}
                  <label>Дата окончания<input type="date" required min={values.startDate} bind:value={values.endDate} /></label>
                  {#if !values.allDay}<label>Время окончания<input type="time" required bind:value={values.endTime} /></label>{/if}
                </div>
                <div class="schedule-actions"><button class="button button--primary" type="submit">{saving ? 'Сохраняем…' : 'Сохранить'}</button><button type="button" class="button button--ghost" on:click={closeEditor}>Отмена</button></div>
              </fieldset>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if saveError}<p role="alert">{saveError}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
</section>

<style>
  .event-schedule { margin-block: 1.5rem; min-width: 0; }
  .schedule-heading, .schedule-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
  h2 { font-size: 1.1rem; margin: 0; }
  .schedule-heading span { overflow-wrap: anywhere; }
  .schedule-past { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; font-size: 0.85rem; }
  .schedule-list { list-style: none; margin: 0; padding: 0; }
  .schedule-list li { border-bottom: 1px solid var(--color-border); padding-block: 0.8rem; }
  .schedule-row p { margin: 0.2rem 0; overflow-wrap: anywhere; }
  .schedule-row button { flex-shrink: 0; min-height: 44px; }
  .schedule-edit { margin-top: 0.8rem; }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { margin-bottom: 0.6rem; font-size: 0.9rem; }
  .schedule-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  .schedule-fields label { min-width: 0; }
  .schedule-fields input { min-width: 0; max-width: 100%; }
  .schedule-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
  @media (max-width: 420px) { .schedule-fields { grid-template-columns: minmax(0, 1fr); } }
</style>

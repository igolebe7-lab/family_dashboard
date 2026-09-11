<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Item } from '$lib/types/domain';
  import type { ActiveFamilyContext } from '$lib/api/pocketbase';
  import { updateEventSeries } from '$lib/api/schedule.api';
  import { createScheduleFormValues, createScheduleInput } from '$lib/composer/schedule-form';
  import { COMPOSER_WEEKDAYS, createRecurrenceRule, createDateTimeIso, type ComposerRepeat } from '$lib/composer/composer-form';
  import RepeatRuleEditor from '../composer/RepeatRuleEditor.svelte';
  export let item: Item;
  export let context: ActiveFamilyContext;
  export let onsaved: (item: Item) => void;
  let open = false;
  let saving = false;
  let error = '';
  let values = createScheduleFormValues(item, item.timezone);
  let repeat: ComposerRepeat = 'weekly';
  let interval = 1;
  let days = [...COMPOSER_WEEKDAYS];
  let until = '';
  let disposed = false;
  onDestroy(() => { disposed = true; });
  function edit() {
    values = createScheduleFormValues(item, item.timezone);
    const durationDays = Math.round((Date.parse(values.endDate) - Date.parse(values.startDate)) / 86400000);
    const tomorrow = createScheduleFormValues({ startAt: new Date(Date.now() + 86400000).toISOString(), allDay: false }, item.timezone).startDate;
    if (values.startDate < tomorrow) {
      values.startDate = tomorrow;
      values.endDate = new Date(Date.parse(tomorrow) + durationDays * 86400000).toISOString().slice(0, 10);
    }
    const parts = Object.fromEntries((item.recurrenceRule || '').replace(/^RRULE:/, '').split(';').map(part => part.split('=')));
    repeat = parts.FREQ === 'DAILY' ? 'daily' : parts.FREQ === 'MONTHLY' ? 'monthly' : 'weekly';
    interval = Number(parts.INTERVAL || 1);
    days = COMPOSER_WEEKDAYS.filter(day => (parts.BYDAY || '').split(',').includes(day));
    if (!days.length) days = [COMPOSER_WEEKDAYS[(new Date(`${values.startDate}T12:00Z`).getUTCDay() + 6) % 7]];
    until = item.recurrenceUntil ? createScheduleFormValues({ startAt: item.recurrenceUntil, allDay: false }, item.timezone).startDate : '';
    error = ''; open = true;
  }
  async function save() {
    const scheduled = createScheduleInput(values, item.timezone);
    if (!scheduled.ok) { error = scheduled.error; return; }
    if (Date.parse(scheduled.input.startAt) <= Date.now()) { error = 'Выберите будущую дату'; return; }
    if (repeat === 'none' || !Number.isInteger(interval) || interval < 1 || interval > 52 || repeat === 'weekly' && !days.length || until && until < values.startDate) { error = 'Проверьте периодичность и окончание повтора'; return; }
    saving = true; error = '';
    try {
      const updated = await updateEventSeries(context, item, { ...scheduled.input,
        recurrenceRule: createRecurrenceRule({ repeat, repeatInterval: interval, repeatDays: days, date: values.startDate })!,
        recurrenceUntil: until ? new Date(Date.parse(createDateTimeIso(until, '23:59', item.timezone)) + 59999).toISOString() : undefined
      });
      if (!disposed) { onsaved(updated); open = false; }
    } catch { error = 'Не удалось изменить серию. Проверьте сеть и даты; если расписание уже изменили, откройте запись заново.'; }
    finally { saving = false; }
  }
</script>
{#if !open}<button type="button" class="button button--soft" on:click={edit}>Изменить серию</button>
{:else}
  <form class="auth-form series-form" on:submit|preventDefault={save}>
    <fieldset disabled={saving}>
      <legend>Будущее расписание</legend>
      <p>Прошедшие занятия, индивидуальные переносы и даты с комментариями сохранятся.</p>
      <label>Начало нового расписания<input type="date" required bind:value={values.startDate} /></label>
      {#if !values.allDay}<label>Время начала<input type="time" required bind:value={values.startTime} /></label>{/if}
      <label>Окончание первого занятия<input type="date" required min={values.startDate} bind:value={values.endDate} /></label>
      {#if !values.allDay}<label>Время окончания<input type="time" required bind:value={values.endTime} /></label>{/if}
      <RepeatRuleEditor bind:value={repeat} bind:interval bind:days bind:until date={values.startDate} />
      {#if error}<p role="alert">{error}</p>{/if}
      <div class="series-actions"><button class="button button--primary" type="submit">{saving ? 'Сохраняем…' : 'Сохранить расписание'}</button><button type="button" class="button button--ghost" on:click={() => open = false}>Отмена</button></div>
    </fieldset>
  </form>
{/if}
<style>
  fieldset { display: grid; gap: 12px; min-width: 0; border: 0; padding: 0; }
  legend { font-weight: 600; margin-bottom: 12px; }
  p { font-size: 14px; color: var(--color-text-muted); }
  .series-form { margin-block: 16px; }
  .series-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>

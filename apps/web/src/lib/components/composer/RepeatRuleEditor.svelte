<script lang="ts">
  import { COMPOSER_WEEKDAYS, getComposerRepeatDays, type ComposerRepeat, type ComposerWeekday } from '$lib/composer/composer-form';
  import type { WeekdayTimes } from '$lib/types/domain';

  export let value: ComposerRepeat = 'none';
  export let interval = 1;
  export let days: ComposerWeekday[] | undefined = undefined;
  export let until = '';
  export let date = '';
  export let enableDayTimes = false;
  export let individualTimes = false;
  export let times: WeekdayTimes = {};
  export let startTime = '09:00';
  export let endTime = '10:00';
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const fullLabels = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  $: selectedDays = getComposerRepeatDays(date, days);
  $: timedDays = value === 'weekdays' ? COMPOSER_WEEKDAYS.slice(0, 5) : selectedDays;
  $: invalidUntil = Boolean(until && date && until < date);
  function toggleDay(day: ComposerWeekday) {
    days = selectedDays.includes(day) ? selectedDays.filter((value) => value !== day) : [...selectedDays, day];
  }
  function setTime(day: ComposerWeekday, field: 'startTime' | 'endTime', time: string) {
    times = { ...times, [day]: { ...(times[day] ?? { startTime, endTime }), [field]: time } };
  }
</script>

<fieldset class="composer-fieldset repeat-editor">
  <legend>Повтор</legend>
  <div class="repeat-fields">
    <label>
      <span>Периодичность</span>
      <select bind:value>
        <option value="none">Не повторять</option>
        <option value="daily">Каждый день</option>
        <option value="weekdays">По будням</option>
        <option value="weekly">По дням недели</option>
        <option value="monthly">Каждый месяц</option>
      </select>
    </label>
    {#if value !== 'none'}
      <label>
        <span>Интервал ({value === 'daily' ? 'дни' : value === 'monthly' ? 'месяцы' : 'недели'})</span>
        <input type="number" min="1" max="52" step="1" required bind:value={interval} />
      </label>
    {/if}
  </div>
  {#if value === 'weekly'}
    <fieldset class="repeat-weekdays">
      <legend>Дни недели</legend>
      <div class="weekday-options">
        {#each COMPOSER_WEEKDAYS as day, index}
          <label class="weekday-option">
            <input type="checkbox" checked={selectedDays.includes(day)} on:change={() => toggleDay(day)} aria-label={fullLabels[index]} />
            <span>{labels[index]}</span>
          </label>
        {/each}
      </div>
      {#if !selectedDays.length}<p class="repeat-error" role="alert">Выберите хотя бы один день недели</p>{/if}
    </fieldset>
  {/if}
  {#if enableDayTimes && (value === 'weekly' || value === 'weekdays')}
    <label class="composer-checkbox repeat-time-toggle">
      <input type="checkbox" bind:checked={individualTimes} />
      <span>Разное время по дням недели</span>
    </label>
    {#if individualTimes}
      <div class="weekday-times">
        {#each timedDays as day (day)}
          <fieldset class="weekday-time-row">
            <legend>{fullLabels[COMPOSER_WEEKDAYS.indexOf(day)]}</legend>
            <label><span>Начало</span><input type="time" required value={times[day]?.startTime ?? startTime} on:input={event => setTime(day, 'startTime', event.currentTarget.value)} aria-label={`Начало · ${fullLabels[COMPOSER_WEEKDAYS.indexOf(day)]}`} /></label>
            <label><span>Окончание</span><input type="time" required value={times[day]?.endTime ?? endTime} on:input={event => setTime(day, 'endTime', event.currentTarget.value)} aria-label={`Окончание · ${fullLabels[COMPOSER_WEEKDAYS.indexOf(day)]}`} /></label>
          </fieldset>
        {/each}
      </div>
    {/if}
  {/if}
  {#if value !== 'none'}
    <label>
      <span>Последний день повтора (необязательно)</span>
      <input type="date" bind:value={until} min={date} aria-invalid={invalidUntil} />
    </label>
    {#if invalidUntil}<p class="repeat-error" role="alert">Окончание повтора не может быть раньше начала</p>{/if}
  {/if}
</fieldset>

<style>
  .repeat-editor { border: 0; padding: 0; margin: 0; gap: 0.65rem; }
  .repeat-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.72rem; }
  .repeat-weekdays { border: 0; padding: 0; margin: 0; min-width: 0; }
  .weekday-options { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
  .weekday-option { display: flex !important; align-items: center; justify-content: center; gap: 0.3rem !important; min-height: 44px; min-width: 44px; padding: 0.3rem; }
  .weekday-option input { width: 16px; height: 16px; padding: 0; accent-color: var(--color-green); }
  .repeat-error { color: var(--color-text); font-size: 0.8rem; margin: 0; }
  .weekday-times { display: grid; gap: 16px; min-width: 0; }
  .weekday-time-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; min-width: 0; border: 0; }
  .weekday-time-row legend { margin-bottom: 8px; font-weight: 600; }
  .repeat-time-toggle { margin-block: 8px; }
  @media (max-width: 420px) { .repeat-fields { grid-template-columns: minmax(0, 1fr); } }
</style>

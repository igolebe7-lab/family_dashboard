<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import type { DayAnnotationInput } from '$lib/api/day-annotations.api';
  import {
    createSpecialDateFormValues,
    createSpecialDateInput,
    validateSpecialDateForm
  } from '$lib/calendar/special-date-form';
  import type { DayAnnotation } from '$lib/types/domain';

  export let annotation: DayAnnotation | undefined = undefined;
  export let selectedDate: Date | undefined = undefined;
  export let titleId = 'special-date-form-title';
  export let saving = false;
  export let error: string | null = null;
  export let onsave: ((input: DayAnnotationInput) => void | Promise<void>) | undefined = undefined;
  export let ondelete: (() => void | Promise<void>) | undefined = undefined;
  export let oncancel: (() => void) | undefined = undefined;

  let values = createSpecialDateFormValues({ annotation, selectedDate });
  let validationErrors: string[] = [];

  $: isBirthday = values.kind === 'birthday';
  $: canDelete = Boolean(annotation && !annotation.readonly);
  $: submitLabel = annotation ? 'Сохранить' : 'Создать';

  async function submitForm(): Promise<void> {
    validationErrors = validateSpecialDateForm(values);
    if (validationErrors.length > 0) return;

    await onsave?.(createSpecialDateInput(values));
  }
</script>

<form class="special-date-form" aria-labelledby={titleId} on:submit|preventDefault={submitForm}>
  <header class="special-date-form__header">
    <div>
      <p class="section-kicker">{annotation ? 'Редактирование' : 'Новая дата'}</p>
      <h2 id={titleId}>{annotation ? 'Особая дата' : 'Добавить дату'}</h2>
    </div>
    <button type="button" aria-label="Закрыть форму" on:click={() => oncancel?.()}>
      <X size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </header>

  {#if error}
    <p class="special-date-form__error">{error}</p>
  {/if}

  {#if validationErrors.length > 0}
    <div class="special-date-form__error">
      {#each validationErrors as validationError}
        <p>{validationError}</p>
      {/each}
    </div>
  {/if}

  <label>
    <span>Тип</span>
    <select bind:value={values.kind}>
      <option value="family_date">Особая дата</option>
      <option value="birthday">День рождения</option>
      <option value="observance">Заметка дня</option>
      <option value="memorial">Памятный день</option>
    </select>
  </label>

  <label>
    <span>Название</span>
    <input bind:value={values.title} maxlength="80" placeholder="Например, годовщина" />
  </label>

  <div class="special-date-form__date-grid">
    <label>
      <span>День</span>
      <input bind:value={values.day} min="1" max="31" type="number" />
    </label>
    <label>
      <span>Месяц</span>
      <input bind:value={values.month} min="1" max="12" type="number" />
    </label>
    <label>
      <span>Год</span>
      <input bind:value={values.year} min="1900" max="2200" type="number" />
    </label>
  </div>

  <label>
    <span>Повтор</span>
    <select bind:value={values.recurrence}>
      <option value="yearly">Каждый год</option>
      <option value="one_time">Только один раз</option>
    </select>
  </label>

  <div class="special-date-form__date-grid">
    <label>
      <span>Цвет</span>
      <select bind:value={values.color}>
        <option value="green">Зелёный</option>
        <option value="lavender">Лавандовый</option>
        <option value="blue">Синий</option>
        <option value="peach">Персиковый</option>
        <option value="yellow">Жёлтый</option>
        <option value="gray">Серый</option>
      </select>
    </label>
    <label>
      <span>Тон</span>
      <select bind:value={values.tone}>
        <option value="positive">Позитивный</option>
        <option value="neutral">Нейтральный</option>
        <option value="important">Важный</option>
        <option value="memorial">Памятный</option>
      </select>
    </label>
  </div>

  {#if isBirthday}
    <div class="special-date-form__birthday">
      <label>
        <span>Имя</span>
        <input bind:value={values.personName} maxlength="60" placeholder="Владимир" />
      </label>
      <label>
        <span>Статус</span>
        <input bind:value={values.personRelation} maxlength="60" placeholder="друг, коллега" />
      </label>
      <label>
        <span>Телефон/контакт</span>
        <input bind:value={values.personContact} maxlength="80" placeholder="+7..." />
      </label>
    </div>
  {/if}

  <label>
    <span>Заметка</span>
    <textarea bind:value={values.description} rows="3" maxlength="240" placeholder="Необязательно"></textarea>
  </label>

  <div class="special-date-form__actions">
    {#if canDelete}
      <button class="special-date-form__delete" disabled={saving} type="button" on:click={() => ondelete?.()}>
        Удалить
      </button>
    {/if}
    <button class="button button--ghost" disabled={saving} type="button" on:click={() => oncancel?.()}>
      Отмена
    </button>
    <button class="button button--primary" disabled={saving} type="submit">{saving ? 'Сохраняем' : submitLabel}</button>
  </div>
</form>

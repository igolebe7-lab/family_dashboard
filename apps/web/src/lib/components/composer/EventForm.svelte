<script lang="ts">
  import { CATEGORY_META, ITEM_CATEGORIES } from '$lib/constants/categories';
  import { FAMILY_TARGET, type ComposerFormValues } from '$lib/composer/composer-form';
  import type { FamilyMember } from '$lib/types/domain';
  import ReminderPicker from './ReminderPicker.svelte';
  import RepeatRuleEditor from './RepeatRuleEditor.svelte';

  export let values: ComposerFormValues;
  export let members: FamilyMember[] = [];

  $: isFamilySelected = values.participants.includes(FAMILY_TARGET);

  function toggleFamilySelection(): void {
    values.participants = isFamilySelected ? [] : [FAMILY_TARGET];
  }

  function toggleMemberSelection(memberId: string): void {
    const selected = values.participants.filter((id) => id !== FAMILY_TARGET);
    values.participants = selected.includes(memberId)
      ? selected.filter((id) => id !== memberId)
      : [...selected, memberId];
  }
</script>

<div class="composer-form-grid">
  <label class="composer-field--wide">
    <span>Название</span>
    <input bind:value={values.title} maxlength="120" placeholder="Например, тренировка" />
  </label>

  <label>
    <span>Категория</span>
    <select bind:value={values.category}>
      {#each ITEM_CATEGORIES as category}
        <option value={category}>{CATEGORY_META[category].label}</option>
      {/each}
    </select>
  </label>

  <label>
    <span>Дата</span>
    <input bind:value={values.date} type="date" />
  </label>

  <label class="composer-checkbox">
    <input bind:checked={values.allDay} type="checkbox" />
    <span>Весь день</span>
  </label>

  {#if !values.allDay}
    <label>
      <span>Начало</span>
      <input bind:value={values.startTime} type="time" />
    </label>
    <label>
      <span>Окончание</span>
      <input bind:value={values.endTime} type="time" />
    </label>
  {/if}

  <label>
    <span>Видимость</span>
    <select bind:value={values.visibility}>
      <option value="family">Вся семья</option>
      <option value="adults">Только взрослые</option>
      <option value="private">Личное</option>
    </select>
  </label>

  <ReminderPicker bind:value={values.reminder} />
  <RepeatRuleEditor bind:value={values.repeat} />

  <fieldset class="composer-fieldset composer-field--wide">
    <legend>Участники</legend>
    <div class="composer-member-grid">
      <label class="composer-member-option composer-member-option--family">
        <input checked={isFamilySelected} type="checkbox" on:change={toggleFamilySelection} />
        <span>Вся семья</span>
      </label>
      {#each members as member (member.id)}
        <label class="composer-member-option">
          <input
            checked={!isFamilySelected && values.participants.includes(member.id)}
            type="checkbox"
            on:change={() => toggleMemberSelection(member.id)}
          />
          <span>{member.displayName}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <label class="composer-field--wide">
    <span>Место</span>
    <input bind:value={values.locationText} maxlength="120" placeholder="Необязательно" />
  </label>

  <label class="composer-field--wide">
    <span>Описание</span>
    <textarea bind:value={values.description} maxlength="400" rows="3" placeholder="Детали события"></textarea>
  </label>
</div>

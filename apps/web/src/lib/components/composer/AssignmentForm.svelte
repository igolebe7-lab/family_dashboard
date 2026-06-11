<script lang="ts">
  import { CATEGORY_META, ITEM_CATEGORIES } from '$lib/constants/categories';
  import type { ComposerFormValues } from '$lib/composer/composer-form';
  import type { FamilyMember } from '$lib/types/domain';
  import ReminderPicker from './ReminderPicker.svelte';
  import RepeatRuleEditor from './RepeatRuleEditor.svelte';

  export let values: ComposerFormValues;
  export let members: FamilyMember[] = [];
</script>

<div class="composer-form-grid">
  <label class="composer-field--wide">
    <span>Название</span>
    <input bind:value={values.title} maxlength="120" placeholder="Например, вынести мусор" />
  </label>

  <label>
    <span>Исполнитель</span>
    <select bind:value={values.assignee}>
      <option value="">Выберите</option>
      {#each members as member (member.id)}
        <option value={member.id}>{member.displayName}</option>
      {/each}
    </select>
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
    <span>Срок</span>
    <input bind:value={values.date} type="date" />
  </label>

  <label>
    <span>Время</span>
    <input bind:value={values.dueTime} type="time" />
  </label>

  <label>
    <span>Баллы</span>
    <input bind:value={values.points} min="0" max="100" type="number" placeholder="0" />
  </label>

  <ReminderPicker bind:value={values.reminder} />
  <RepeatRuleEditor bind:value={values.repeat} />

  <label class="composer-checkbox">
    <input bind:checked={values.approvalRequired} type="checkbox" />
    <span>Нужно подтверждение</span>
  </label>

  <label class="composer-field--wide">
    <span>Описание</span>
    <textarea bind:value={values.description} maxlength="400" rows="3" placeholder="Что именно нужно сделать"></textarea>
  </label>
</div>

<script lang="ts">
  import { CATEGORY_META, ITEM_CATEGORIES } from '$lib/constants/categories';
  import { FAMILY_TARGET, type ComposerFormValues } from '$lib/composer/composer-form';
  import type { FamilyMember } from '$lib/types/domain';
  import ReminderPicker from './ReminderPicker.svelte';
  import RepeatRuleEditor from './RepeatRuleEditor.svelte';

  export let values: ComposerFormValues;
  export let members: FamilyMember[] = [];

  $: activeMember = members.find((member) => member.id === values.activeMemberId);
  $: hasActiveMemberOption = Boolean(values.activeMemberId);
  $: isActiveMemberInList = members.some((member) => member.id === values.activeMemberId);
  $: isAssignment = Boolean(values.owner && values.owner !== values.activeMemberId);
  $: isFamilyTask = values.owner === FAMILY_TARGET;
  $: if (isFamilyTask && values.visibility !== 'family') values.visibility = 'family';
  $: if (isAssignment && !isFamilyTask && values.visibility !== 'assignees') values.visibility = 'assignees';
</script>

<div class="composer-form-grid">
  <label class="composer-field--wide">
    <span>Название</span>
    <input bind:value={values.title} maxlength="120" placeholder="Например, купить батарейки" />
  </label>

  <label>
    <span>Для кого</span>
    <select bind:value={values.owner}>
      <option value="">Выберите</option>
      {#if hasActiveMemberOption}
        <option value={values.activeMemberId}>
          Текущий профиль{activeMember ? ` · ${activeMember.displayName}` : ''}
        </option>
      {/if}
      <option value={FAMILY_TARGET}>Вся семья</option>
      {#each members as member (member.id)}
        {#if member.id !== values.activeMemberId || !isActiveMemberInList}
          <option value={member.id}>{member.displayName}</option>
        {/if}
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
    <span>Дата</span>
    <input bind:value={values.date} type="date" />
  </label>

  <label>
    <span>Время</span>
    <input bind:value={values.dueTime} type="time" />
  </label>

  <label>
    <span>Приоритет</span>
    <select bind:value={values.priority}>
      <option value="low">Низкий</option>
      <option value="normal">Обычный</option>
      <option value="high">Высокий</option>
      <option value="urgent">Срочно</option>
    </select>
  </label>

  <label>
    <span>Видимость</span>
    <select bind:value={values.visibility} disabled={isAssignment || isFamilyTask}>
      <option value="private">Личное</option>
      <option value="family">Вся семья</option>
      <option value="assignees">Исполнитель</option>
      <option value="adults">Только взрослые</option>
    </select>
  </label>

  <ReminderPicker bind:value={values.reminder} />
  <RepeatRuleEditor bind:value={values.repeat} />

  {#if isAssignment}
    <label class="composer-checkbox">
      <input bind:checked={values.approvalRequired} type="checkbox" />
      <span>Нужно подтверждение</span>
    </label>

    <label>
      <span>Баллы</span>
      <input bind:value={values.points} min="0" max="100" type="number" placeholder="0" />
    </label>
  {/if}

  <label class="composer-field--wide">
    <span>Чеклист</span>
    <textarea bind:value={values.checklistText} rows="3" placeholder="Каждый пункт с новой строки"></textarea>
  </label>

  <label class="composer-field--wide">
    <span>Описание</span>
    <textarea bind:value={values.description} maxlength="400" rows="3" placeholder="Необязательно"></textarea>
  </label>
</div>

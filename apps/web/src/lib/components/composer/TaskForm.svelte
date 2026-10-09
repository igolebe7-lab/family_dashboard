<script lang="ts">
  import { CATEGORY_META, ITEM_CATEGORIES } from '$lib/constants/categories';
  import { FAMILY_TARGET, getWorkTargets, canRewardWorkTarget, type ComposerFormValues } from '$lib/composer/composer-form';
  import type { FamilyMember } from '$lib/types/domain';
  import ReminderPicker from './ReminderPicker.svelte';
  import RepeatRuleEditor from './RepeatRuleEditor.svelte';

  export let values: ComposerFormValues;
  export let members: FamilyMember[] = [];

  $: activeMember = members.find((member) => member.id === values.activeMemberId);
  $: targets = getWorkTargets(values.activeMemberId, members);
  $: canSelectFamily = targets.length > 1 && targets.length === members.filter(member => member.active && member.family === activeMember?.family).length;
  $: canReward = canRewardWorkTarget(values.activeMemberId, values.owner, members);
  $: if (!canReward && values.points) values.points = '';
  $: if (canReward && Number(values.points) > 0) values.approvalRequired = true;
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

  <fieldset class="work-target-field composer-field--wide">
    <legend>Исполнитель</legend>
    <div class="work-target-options">
      {#each targets as member (member.id)}
        <label class:work-target--selected={values.owner === member.id} class:work-target--long={member.displayName.length > 20} class="work-target" style={`--target-tone: var(--color-${member.colorKey || 'green'})`}>
          <input type="radio" name="work-target" value={member.id} bind:group={values.owner} />
          <span class="work-target__avatar" aria-hidden="true">{member.displayName.charAt(0)}</span>
          <span>{member.displayName}{#if member.id === activeMember?.id}<small>Я</small>{/if}</span>
        </label>
      {/each}
      {#if canSelectFamily}<label class:work-target--selected={values.owner === FAMILY_TARGET} class="work-target work-target--family"><input type="radio" name="work-target" value={FAMILY_TARGET} bind:group={values.owner} /><span>Общее дело<small>Любой из семьи может выполнить</small></span></label>{/if}
    </div>
    {#if !targets.length}<p role="alert">Профили не загрузились. Закройте форму и обновите список семьи.</p>{/if}
  </fieldset>

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
  <RepeatRuleEditor bind:value={values.repeat} bind:interval={values.repeatInterval} bind:days={values.repeatDays} bind:until={values.repeatUntil} date={values.date} />

  {#if isAssignment}
    <label class="composer-checkbox">
      <input bind:checked={values.approvalRequired} disabled={canReward && Number(values.points) > 0} type="checkbox" />
      <span>{canReward ? 'Подтвердить выполнение родителем' : 'Подтвердить выполнение'}</span>
    </label>

    {#if canReward}
    <label>
      <span>Баллы после подтверждения</span>
      <input value={values.points} on:input={event => values.points = event.currentTarget.value} min="0" max="100" step="1" type="number" placeholder="0" />
    </label>
    {/if}
  {/if}

  <label class="composer-field--wide">
    <span>Чек-лист</span>
    <textarea bind:value={values.checklistText} rows="3" placeholder="Каждый пункт с новой строки"></textarea>
  </label>

  <label class="composer-field--wide">
    <span>Описание</span>
    <textarea bind:value={values.description} maxlength="400" rows="3" placeholder="Необязательно"></textarea>
  </label>
</div>

<style>
  .work-target-field { min-width: 0; margin: 0; border: 0; padding: 0; }
  legend { margin-bottom: 10px; font-size: 14px; }
  .work-target-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  .work-target { display: flex; align-items: center; gap: 8px; min-height: 52px; min-width: 0; padding: 10px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); cursor: pointer; }
  .work-target--selected { background: var(--color-green-soft); border-color: var(--color-green); }
  .work-target:focus-within { outline: 2px solid var(--color-green); outline-offset: 2px; }
  .work-target > span:last-child { min-width: 0; overflow-wrap: anywhere; font-size: 14px; }
  .work-target input { width: 18px; height: 18px; flex: 0 0 18px; accent-color: var(--color-green); }
  .work-target__avatar { display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 28px; border-radius: 50%; background: color-mix(in srgb, var(--target-tone) 16%, var(--color-surface)); color: var(--target-tone); font-weight: 600; }
  small { display: block; margin-top: 3px; font-size: 12px; color: var(--color-text-muted); }
  .work-target--family, .work-target--long { grid-column: 1 / -1; }
</style>

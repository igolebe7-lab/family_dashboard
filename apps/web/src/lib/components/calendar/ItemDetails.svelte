<script lang="ts">
  import { onDestroy } from 'svelte';
  import Pencil from '@lucide/svelte/icons/pencil';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import MapPin from '@lucide/svelte/icons/map-pin';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Users from '@lucide/svelte/icons/users';
  import { getItem, updateItemDetails } from '$lib/api/items.api';
  import { familyStore, getActiveFamilyContext } from '$lib/stores/family.store';
  import { CATEGORY_META } from '$lib/constants/categories';
  import type { Item } from '$lib/types/domain';
  import { describeRecurrence } from '$lib/composer/recurrence-summary';
  import EventSchedule from './EventSchedule.svelte';
  import Archive from '@lucide/svelte/icons/archive';
  import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
  import { setItemArchived } from '$lib/api/schedule.api';
  export let itemId: string;
  let item: Item | null = null;
  let loading = true;
  let error = '';
  let message = '';
  let editing = false;
  let saving = false;
  let archiving = false;
  let title = '';
  let description = '';
  let locationText = '';
  let version = 0;
  $: context = getActiveFamilyContext($familyStore);
  $: loadItem(itemId, context?.familyId, context?.memberId);
  $: canEdit = item && $familyStore.activeMember && (
    item.createdBy === $familyStore.activeMember.id ||
    item.owner === $familyStore.activeMember.id ||
    $familyStore.activeMember.role === 'owner'
  );
  const visibility = { private: 'Личное', family: 'Вся семья', adults: 'Только взрослые', assignees: 'Участники и ответственные' };
  const kinds = { event: 'Событие', task: 'Дело', assignment: 'Поручение', routine: 'Рутина' };
  $: participantIds = item ? [...new Set([item.owner, ...item.assignees, ...item.participants].filter(Boolean))] : [];
  $: people = $familyStore.members.filter((member) => participantIds.includes(member.id));

  async function loadItem(id?: string, _family?: string, _member?: string) {
    const request = ++version;
    item = null; error = ''; message = ''; editing = false; archiving = false;
    if (!id || !context) { loading = false; return; }
    loading = true;
    try {
      const record = await getItem(id, context);
      if (request === version) item = record;
    } catch {
      if (request === version) error = 'Запись недоступна или не удалось подключиться к серверу.';
    } finally {
      if (request === version) loading = false;
    }
  }
  function edit() {
    if (!item) return;
    title = item.title; description = item.description ?? ''; locationText = item.locationText ?? '';
    editing = true; message = '';
  }
  async function toggleArchive() {
    if (!item || !context || !canEdit || archiving || saving) return;
    const archived = !item.archived;
    if (!window.confirm(archived
      ? 'Убрать запись из активного расписания? Новые повторы остановятся, история сохранится.'
      : 'Вернуть запись в активное расписание? Повторы продолжатся по прежнему правилу.')) return;
    const request = version;
    const current = item;
    archiving = true; error = ''; message = '';
    try {
      await setItemArchived(context, current.id, archived);
      if (request !== version) return;
      item = { ...current, archived };
      message = archived ? 'Запись в архиве. История сохранена' : 'Запись возвращена в расписание';
    } catch {
      if (request === version) error = 'Не удалось изменить архив. Проверьте подключение и права доступа.';
    } finally {
      if (request === version) archiving = false;
    }
  }
  async function save() {
    if (!item || !context || saving) return;
    const request = version;
    saving = true; error = '';
    try {
      const updated = await updateItemDetails(item.id, { title, description, locationText }, context);
      if (request !== version) return;
      item = updated; editing = false; message = 'Изменения сохранены';
    } catch {
      if (request === version) error = 'Не удалось сохранить. Проверьте поля и подключение.';
    } finally { saving = false; }
  }
  function formatDate(value?: string) {
    return value ? new Intl.DateTimeFormat('ru', {
      day: 'numeric', month: 'long', year: 'numeric',
      ...(item?.allDay ? {} : { hour: '2-digit', minute: '2-digit' }),
      timeZone: item?.timezone || undefined
    }).format(new Date(value)) : 'Без срока';
  }
  onDestroy(() => { version += 1; });
</script>

<div class="item-detail-content">
  {#if loading}<p class="page-empty-state" role="status">Загружаем запись…</p>{/if}
  {#if error}<div class="page-error" role="alert"><p>{error}</p>{#if !item}<button class="button button--soft" on:click={() => loadItem(itemId)}>Повторить</button>{/if}</div>{/if}
  {#if message}<p class="today-action-message" role="status">{message}</p>{/if}
  {#if item}
    <header class="page-heading">
      <div><p class="section-kicker">{kinds[item.kind]} · {CATEGORY_META[item.category]?.label}</p><h1>{item.title}</h1></div>
      {#if canEdit && !editing}<button class="button button--soft" disabled={archiving} on:click={edit}><Pencil size={17} aria-hidden="true" />Изменить</button>{/if}
    </header>
    {#if editing}
      <form class="detail-edit auth-form" on:submit|preventDefault={save}>
        <label>Название<input bind:value={title} required maxlength="120" /></label>
        <label>Описание<textarea bind:value={description} maxlength="2000" rows="5"></textarea></label>
        {#if item.kind === 'event'}<label>Место<input bind:value={locationText} maxlength="200" /></label>{/if}
        <div class="detail-actions"><button class="button button--primary" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button><button type="button" class="button button--ghost" disabled={saving} on:click={() => editing = false}>Отмена</button></div>
      </form>
    {:else}
      <dl class="item-details">
        <div><dt><CalendarDays size={19} aria-hidden="true" />{item.kind === 'event' ? 'Когда' : 'Срок'}</dt><dd>{formatDate(item.startAt || item.dueAt)}{#if item.endAt}<br />до {formatDate(item.endAt)}{/if}</dd></div>
        <div><dt><Users size={19} aria-hidden="true" />Участники</dt><dd>{people.map((member) => member.displayName).join(', ') || 'Не указаны'}</dd></div>
        <div><dt><ShieldCheck size={19} aria-hidden="true" />Видимость</dt><dd>{visibility[item.visibility]}</dd></div>
        {#if item.locationText}<div><dt><MapPin size={19} aria-hidden="true" />Место</dt><dd>{item.locationText}</dd></div>{/if}
      </dl>
      {#if item.description}<section class="item-description"><h2>Описание</h2><p>{item.description}</p></section>{/if}
      {#if item.checklist?.length}<section class="item-description"><h2>Чеклист</h2><ul>{#each item.checklist as step}<li>{step.title}</li>{/each}</ul></section>{/if}
      {#if item.recurrenceRule}<p class="results-count">{describeRecurrence(item.recurrenceRule, item.recurrenceUntil, item.timezone)}</p>{/if}
      {#if item.archived}<p class="results-count">В архиве · новые повторы остановлены</p>{/if}
      {#if canEdit}<button type="button" class="button button--soft" disabled={archiving} on:click={toggleArchive}>{#if item.archived}<ArchiveRestore size={18} aria-hidden="true" />{:else}<Archive size={18} aria-hidden="true" />{/if}{archiving ? 'Сохраняем…' : item.archived ? 'Вернуть из архива' : 'В архив'}</button>{/if}
      {#if item.kind === 'event' && context}<details class="item-schedule-details"><summary>{item.recurrenceRule ? 'Расписание и перенос' : 'Дата и перенос события'}</summary><EventSchedule {item} {context} canEdit={Boolean(canEdit) && !item.archived && !archiving} /></details>{/if}
      {#if item.kind === 'assignment'}<a class="button button--primary" href="/app/assignments">Перейти к поручениям</a>{/if}
      {#if item.kind === 'task'}<a class="button button--primary" href="/app/tasks">Перейти к делам</a>{/if}
    {/if}
  {/if}
</div>

<style>
  .item-schedule-details { margin-top: 20px; border-top: 1px solid var(--color-border); padding-top: 12px; }
  summary { cursor: pointer; min-height: 44px; padding: 12px 0; font-weight: 600; }
</style>

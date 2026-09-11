<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import PriorityFilter from '../composer/PriorityFilter.svelte';
  import type { ItemPriority } from '$lib/types/domain';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Search from '@lucide/svelte/icons/search';
  import AssignmentCard from './AssignmentCard.svelte';
  import { filterWorkCards, type AssignmentAction, type AssignmentCardModel, type WorkStatusGroup } from '$lib/assignments/assignments-view';
  import type { WorkListState } from '$lib/assignments/work-list';

  export let titleId: string;
  export let kind: 'assignment' | 'task';
  export let cards: AssignmentCardModel[];
  export let state: WorkListState;
  export let status: WorkStatusGroup | 'all' = 'open';
  export let memberId = '';
  export let query = '';
  export let priority: ItemPriority | 'all' = 'all';
  export let oncreate: () => void;
  export let onreload: () => void;
  export let onaction: (action: AssignmentAction, card: AssignmentCardModel, reason?: string) => void | Promise<void>;

  const groups: { value: WorkStatusGroup | 'all'; label: string }[] = [
    { value: 'open', label: 'Нужно сделать' }, { value: 'review', label: 'На проверке' },
    { value: 'completed', label: 'Готово' }, { value: 'cancelled', label: 'Отменено' }, { value: 'all', label: 'Все' }
  ];
  $: title = kind === 'task' ? 'Дела' : 'Поручения';
  $: scoped = filterWorkCards(cards, 'all', memberId, query, priority);
  $: filtered = filterWorkCards(scoped, status);
  $: canCreate = Boolean(state.context && state.family?.activeMember && (kind === 'task' ? ['owner', 'parent', 'adult', 'teen'] : ['owner', 'parent', 'adult']).includes(state.family.activeMember.role));
  $: members = (state.family?.members ?? []).filter((member) => member.active && member.family === state.context?.familyId);
</script>

<section class="work-page" aria-labelledby={titleId}>
  <header class="work-header">
    <h1 id={titleId}>{title}</h1>
    <div class="header-actions">
      <button class="icon-control" type="button" title="Обновить список" aria-label="Обновить список" disabled={!state.context || state.loading || Boolean(state.busyId)} on:click={onreload}><RefreshCw size={19} aria-hidden="true" /></button>
      {#if canCreate}<button class="create-control" type="button" on:click={oncreate}><Plus size={19} aria-hidden="true" />Создать</button>{/if}
    </div>
  </header>
  <div class="work-filters">
    <PriorityFilter bind:value={priority} />
    <label class="search-control"><Search size={18} aria-hidden="true" /><input type="search" aria-label={`Поиск: ${title.toLocaleLowerCase('ru')}`} placeholder="Поиск" bind:value={query} /></label>
    <label class="member-control"><span>Исполнитель</span><select bind:value={memberId}><option value="">Все</option>{#each members as member (member.id)}<option value={member.id}>{member.displayName}</option>{/each}</select></label>
  </div>
  <div class="status-controls" role="group" aria-label="Статус">
    {#each groups.filter((group) => kind !== 'task' || group.value !== 'review') as group}
      <button type="button" aria-pressed={status === group.value} on:click={() => status = group.value}>{group.label}<span>{filterWorkCards(scoped, group.value).length}</span></button>
    {/each}
  </div>
  <p class="range-label">Последние 30 дней и ближайшие 90 дней · незавершённые и без срока</p>
  {#if state.error}<div class="work-error" role="alert"><p>{state.error}</p><button type="button" disabled={state.loading} on:click={onreload}>Повторить</button></div>{/if}
  {#if state.actionError}<p class="work-error" role="alert">{state.actionError}</p>{/if}
  {#if state.message}<p class="work-message" role="status">{state.message}</p>{/if}
  {#if state.loading}<p class="work-state" role="status">{state.loaded ? 'Обновляем список...' : 'Загружаем...'}</p>{/if}
  {#if !state.context}<p class="work-state">{state.family?.status === 'loading' || state.family?.status === 'idle' ? 'Подключаем профиль...' : 'Нет доступного профиля семьи.'}</p>
  {:else if state.loaded && !state.loading && !state.error && filtered.length === 0}
    <div class="empty-state"><p>{cards.length === 0 ? kind === 'task' ? 'Дел пока нет.' : 'Поручений пока нет.' : 'По этим фильтрам ничего не найдено.'}</p>{#if cards.length > 0}<button type="button" on:click={() => { status = 'all'; memberId = ''; query = ''; priority = 'all'; }}>Сбросить фильтры</button>{/if}</div>
  {/if}
  <div class="work-cards" aria-busy={state.loading}>
    {#each filtered as card (card.id)}<AssignmentCard {card} busy={state.busyId === card.id} disabled={state.loading || Boolean(state.error) || Boolean(state.busyId && state.busyId !== card.id)} {onaction} />{/each}
  </div>
</section>

<style>
  .work-page { min-width: 0; padding: 8px 0 24px; }
  .work-header, .header-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h1 { margin: 0; font-size: 28px; line-height: 1.2; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: default; opacity: .5; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--color-green); outline-offset: 3px; }
  .icon-control, .create-control { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); }
  .icon-control { width: 44px; flex: 0 0 44px; }
  .create-control { padding: 0 12px; background: var(--color-green-soft); }
  .work-filters { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin: 24px 0 16px; }
  .search-control { display: flex; align-items: center; gap: 8px; flex: 1 1 170px; min-height: 44px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-muted); }
  input { width: 100%; min-width: 0; min-height: 42px; border: 0; background: transparent; color: var(--color-text); }
  .member-control { display: grid; gap: 5px; flex: 1 1 140px; }
  .member-control span, .range-label { color: var(--color-text-muted); font-size: 12px; }
  select { width: 100%; min-height: 44px; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); }
  .status-controls { display: flex; flex-wrap: wrap; gap: 8px; }
  .status-controls button { display: flex; align-items: center; gap: 8px; min-height: 44px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; color: var(--color-text-muted); background: var(--color-surface); font-size: 13px; }
  .status-controls button[aria-pressed='true'] { color: var(--color-text); border-color: var(--color-green); background: var(--color-green-soft); }
  .status-controls span { font-variant-numeric: tabular-nums; min-width: 18px; text-align: center; }
  .range-label { margin: 12px 0 20px; line-height: 1.5; }
  .work-cards { display: grid; gap: 12px; }
  .work-state, .empty-state { padding: 24px 0; color: var(--color-text-muted); }
  .work-error, .work-message { padding: 12px; border-radius: 8px; overflow-wrap: anywhere; }
  .work-error { background: var(--color-danger-soft); color: var(--color-text); }
  .work-message { background: var(--color-green-soft); }
  .work-error button, .empty-state button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); }
  @media (min-width: 1100px) { .work-page { padding: 16px 0 32px; max-width: 1020px; } .work-filters { max-width: 660px; } }
</style>

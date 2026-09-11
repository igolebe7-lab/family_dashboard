<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import AssignmentCard from '$lib/components/assignments/AssignmentCard.svelte';
  import { createChildModeViewModel, filterWorkCards, getChildModeAccess, type WorkStatusGroup, type AssignmentAction, type AssignmentCardModel } from '$lib/assignments/assignments-view';
  import { createWorkList } from '$lib/assignments/work-list';
  import { familyStore } from '$lib/stores/family.store';
  import { sessionStore } from '$lib/stores/session.store';

  const list = createWorkList('child');
  let status: WorkStatusGroup = 'open';
  let mounted = false;
  $: access = getChildModeAccess($familyStore.members, $sessionStore.isAuthenticated ? $sessionStore.user?.id : undefined, $familyStore.activeFamily?.id, $familyStore.activeMember?.id);
  $: selectedChild = access.selectedChild;
  $: if (mounted) void list.setFamily({ ...$familyStore, activeMember: selectedChild ?? null });
  $: model = createChildModeViewModel({ occurrences: $list.occurrences, items: $list.items, members: $list.family?.members ?? [], activeMemberId: $list.context?.memberId, timezone: $list.family?.activeFamily?.timezone });
  $: cards = filterWorkCards(model.assignmentCards, status);
  const groups: { value: WorkStatusGroup; label: string }[] = [{ value: 'open', label: 'Надо сделать' }, { value: 'review', label: 'Ждёт проверки' }, { value: 'completed', label: 'Готово' }];
  function runAction(action: AssignmentAction, card: AssignmentCardModel) { return list.act(action, card.id); }
  function selectChild(id: string) {
    const child = access.children.find((member) => member.id === id);
    if (!child) return;
    status = 'open';
    familyStore.setActiveMember(child);
  }
  async function returnToFamily() {
    if (access.adult) familyStore.setActiveMember(access.adult);
    await goto('/app/family');
  }
  onMount(() => {
    mounted = true;
    return () => { mounted = false; list.destroy(); };
  });
</script>

<main class="child-mode" aria-labelledby="child-title">
  {#if access.adult || access.children.length > 1}
    <div class="parent-controls">
      {#if access.adult}<button type="button" class="back" on:click={returnToFamily}><ArrowLeft size={18} aria-hidden="true" />К семье</button>{/if}
      {#if access.children.length > 0}
        <label><span>Детский профиль</span><select aria-label="Детский профиль" value={selectedChild?.id ?? ''} on:change={(event) => selectChild(event.currentTarget.value)}><option value="" disabled>Выберите ребёнка</option>{#each access.children as child (child.id)}<option value={child.id}>{child.displayName}</option>{/each}</select></label>
      {/if}
    </div>
  {/if}
  <header class="child-header">
    <div><p class="section-kicker">Детский режим</p><h1 id="child-title">{model.greeting}</h1></div>
    <button type="button" class="refresh" title="Обновить" aria-label="Обновить" disabled={!$list.context || $list.loading || Boolean($list.busyId)} on:click={list.reload}><RefreshCw size={21} aria-hidden="true" /></button>
  </header>
  {#if $list.message}<p class="message" role="status">{$list.message}</p>{/if}
  {#if $list.actionError}<p class="error" role="alert">{$list.actionError}</p>{/if}
  {#if $list.error}<div class="error" role="alert"><p>{$list.error}</p><button type="button" disabled={$list.loading} on:click={list.reload}>Попробовать ещё</button></div>{/if}
  {#if !$list.context}
    <p class="state">{$familyStore.status === 'loading' || $familyStore.status === 'idle' ? 'Подключаем профиль...' : access.children.length > 0 ? 'Выберите детский профиль.' : 'Нет доступных детских профилей.'}</p>
  {:else}
    {#if $list.loading}<p class="state" role="status">{$list.loaded ? 'Обновляем...' : 'Загружаем твои дела...'}</p>{/if}
    <section class="child-section" aria-labelledby="child-work-title">
      <h2 id="child-work-title">Твои дела</h2>
      <div class="filters" role="group" aria-label="Статус дела">
        {#each groups as group}<button type="button" aria-pressed={status === group.value} on:click={() => status = group.value}>{group.label}<span>{filterWorkCards(model.assignmentCards, group.value).length}</span></button>{/each}
      </div>
      <div class="assignments-list" aria-busy={$list.loading}>
        {#each cards as card (card.id)}<AssignmentCard {card} busy={$list.busyId === card.id} disabled={$list.loading || Boolean($list.error) || Boolean($list.busyId && $list.busyId !== card.id)} onaction={runAction} />{/each}
        {#if $list.loaded && !$list.loading && !$list.error && cards.length === 0}<p class="state">{status === 'open' ? 'Сейчас ничего не нужно делать.' : status === 'review' ? 'Ничего не ждёт проверки.' : 'Здесь появятся выполненные дела.'}</p>{/if}
      </div>
    </section>
    <section class="child-section" aria-labelledby="child-schedule-title">
      <h2 id="child-schedule-title">Сегодня</h2>
      <div class="schedule">
        {#each model.scheduleItems as item (item.id)}<article><time>{item.time}</time><strong>{item.title}</strong></article>{/each}
        {#if $list.loaded && !$list.loading && !$list.error && model.scheduleItems.length === 0}<p class="state">На сегодня событий нет.</p>{/if}
      </div>
    </section>
  {/if}
</main>

<style>
  .child-mode { max-width: 760px; margin: 0 auto; padding: 28px 20px 40px; }
  .child-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h1 { font-size: 28px; overflow-wrap: anywhere; margin: 6px 0; }
  h2 { font-size: 21px; margin: 0 0 18px; }
  .child-header > div { min-width: 0; }
  .parent-controls { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; justify-content: space-between; padding-bottom: 24px; }
  .parent-controls label { display: grid; gap: 6px; flex: 1 1 170px; max-width: 320px; font-size: 13px; color: var(--color-text-muted); }
  .parent-controls select { min-height: 48px; width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); font: inherit; }
  .parent-controls select:focus-visible { outline: 2px solid var(--color-green); outline-offset: 3px; }
  .back { display: inline-flex; gap: 8px; align-items: center; }
  .child-section { margin-top: 32px; }
  button { font: inherit; color: var(--color-text); cursor: pointer; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); min-height: 48px; padding: 10px 12px; }
  button:focus-visible { outline: 2px solid var(--color-green); outline-offset: 3px; }
  button:disabled { opacity: .5; cursor: default; }
  .refresh { width: 48px; flex: 0 0 48px; display: grid; place-items: center; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .filters button { display: flex; gap: 8px; align-items: center; font-size: 14px; }
  .filters button[aria-pressed='true'] { border-color: var(--color-green); background: var(--color-green-soft); }
  .filters span { min-width: 18px; font-variant-numeric: tabular-nums; text-align: center; }
  .schedule { display: grid; gap: 12px; }
  .schedule article { display: flex; gap: 16px; align-items: baseline; border-bottom: 1px solid var(--color-border); padding: 16px 0; }
  .schedule time { flex: 0 0 75px; color: var(--color-text-muted); font-size: 14px; }
  .schedule strong { min-width: 0; overflow-wrap: anywhere; }
  .state { padding: 16px 0; color: var(--color-text-muted); }
  .message, .error { margin: 16px 0; padding: 12px; border-radius: 8px; overflow-wrap: anywhere; }
  .message { background: var(--color-green-soft); }
  .error { background: var(--color-danger-soft); }
</style>

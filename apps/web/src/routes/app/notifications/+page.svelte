<script lang="ts">
  import { onMount } from 'svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import { listNotifications, markAllNotificationsRead, markNotificationRead, subscribeNotifications, type InboxNotification } from '$lib/api/notifications.api';
  import { mapNotificationInboxItem } from '$lib/assignments/assignments-view';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';

  const activeRoute = '/app/today';
  const pageSize = 30;
  let familyState: FamilyState;
  let records: InboxNotification[] = [];
  let loading = true;
  let busy = false;
  let unreadOnly = false;
  let error: string | null = null;
  let actionError: string | null = null;
  let message: string | null = null;
  let realtimeError = false;
  let page = 0;
  let hasMore = false;
  let failedPage = 1;
  let scope = 0;
  let request = 0;
  let subscription = 0;
  let scopeKey: string | null = null;
  let stopRealtime: (() => void) | undefined;
  let actionController: AbortController | undefined;

  $: items = records.map(record => ({ ...mapNotificationInboxItem(record), destination: record.destination }));

  async function loadNotifications(nextPage = 1): Promise<void> {
    const context = familyState?.status === 'ready' ? getActiveFamilyContext(familyState) : null;
    if (!context || !scopeKey || busy) return;
    const ticket = ++request;
    const currentScope = scope;
    loading = true;
    error = null;
    failedPage = nextPage;
    try {
      const incoming = await listNotifications(context, { limit: pageSize, page: nextPage, unreadOnly });
      if (ticket !== request || currentScope !== scope) return;
      records = nextPage === 1 ? incoming : [...records, ...incoming.filter(record => !records.some(existing => existing.id === record.id))];
      page = nextPage;
      hasMore = incoming.length === pageSize;
    } catch {
      if (ticket === request && currentScope === scope) error = 'Не удалось загрузить уведомления. Проверьте подключение и попробуйте ещё раз.';
    } finally {
      if (ticket === request && currentScope === scope) loading = false;
    }
  }

  async function connectRealtime(): Promise<void> {
    const context = familyState?.status === 'ready' ? getActiveFamilyContext(familyState) : null;
    if (!context || !scopeKey) return;
    const currentScope = scope;
    const ticket = ++subscription;
    realtimeError = false;
    stopRealtime?.();
    stopRealtime = undefined;
    try {
      const stop = await subscribeNotifications(context, () => {
        if (currentScope === scope && ticket === subscription) void loadNotifications();
      });
      if (currentScope !== scope || ticket !== subscription) stop();
      else stopRealtime = stop;
    } catch {
      if (currentScope === scope && ticket === subscription) realtimeError = true;
    }
  }

  async function markRead(id?: string): Promise<void> {
    const context = familyState?.status === 'ready' ? getActiveFamilyContext(familyState) : null;
    if (!context || !scopeKey || busy) return;
    const currentScope = scope;
    const controller = new AbortController();
    actionController = controller;
    request += 1;
    loading = false;
    busy = true;
    actionError = null;
    message = null;
    try {
      const updated = id ? [await markNotificationRead(id, context)] : await markAllNotificationsRead(context, undefined, controller.signal);
      if (currentScope !== scope) return;
      const readRecords = new Map(updated.map(record => [record.id, record]));
      records = records.map(record => readRecords.has(record.id) ? { ...record, readAt: readRecords.get(record.id)?.readAt } : record);
      if (unreadOnly) records = records.filter(record => !record.readAt);
      message = id ? 'Уведомление прочитано.' : 'Все уведомления на момент нажатия прочитаны.';
    } catch {
      if (currentScope === scope) actionError = 'Не удалось отметить уведомления. Часть изменений могла сохраниться. Попробуйте ещё раз.';
    } finally {
      if (currentScope === scope) {
        busy = false;
        actionController = undefined;
        void loadNotifications();
      }
    }
  }

  function changeFilter(value: boolean): void {
    if (busy || value === unreadOnly) return;
    unreadOnly = value;
    records = [];
    page = 0;
    hasMore = false;
    message = null;
    actionError = null;
    void loadNotifications();
  }

  onMount(() => {
    const unsubscribe = familyStore.subscribe((state) => {
      familyState = state;
      const context = state.status === 'ready' ? getActiveFamilyContext(state) : null;
      const nextKey = context ? `${context.familyId}:${context.memberId}` : null;
      if (nextKey === scopeKey && nextKey !== null) return;
      scopeKey = nextKey;
      scope += 1;
      request += 1;
      actionController?.abort();
      stopRealtime?.();
      stopRealtime = undefined;
      records = [];
      page = 0;
      hasMore = false;
      busy = false;
      message = null;
      actionError = null;
      error = state.status === 'error' ? 'Не удалось подключить семью. Откройте раздел «Семья» и повторите загрузку.' : null;
      realtimeError = false;
      loading = state.status === 'loading' || state.status === 'idle';
      if (context) {
        void loadNotifications();
        void connectRealtime();
      }
    });
    return () => {
      scope += 1;
      request += 1;
      unsubscribe();
      actionController?.abort();
      stopRealtime?.();
    };
  });
</script>

<svelte:window on:online={() => { void loadNotifications(); void connectRealtime(); }} />

{#snippet inboxContent()}
  <div class="inbox-toolbar">
    <div class="inbox-filters" role="group" aria-label="Фильтр уведомлений">
      <button class="button button--soft" aria-pressed={!unreadOnly} disabled={busy} type="button" on:click={() => changeFilter(false)}>Все</button>
      <button class="button button--soft" aria-pressed={unreadOnly} disabled={busy} type="button" on:click={() => changeFilter(true)}>Непрочитанные</button>
    </div>
    <button class="button button--soft" type="button" disabled={busy || loading || !scopeKey || (!records.some(record => !record.readAt) && !hasMore)} on:click={() => markRead()}>{busy ? 'Отмечаем…' : 'Прочитать все'}</button>
  </div>
  {#if error}
    <p class="today-action-message today-action-message--error" role="alert">{error}</p>
    {#if scopeKey}<button class="button button--soft" type="button" disabled={loading || busy} on:click={() => loadNotifications(failedPage)}>Повторить</button>{/if}
  {/if}
  {#if actionError}<p class="today-action-message today-action-message--error" role="alert">{actionError}</p>{/if}
  {#if message}<p class="today-action-message" role="status">{message}</p>{/if}
  {#if realtimeError}
    <p role="status">Автообновление недоступно.</p>
    <button class="button button--soft" type="button" disabled={busy} on:click={() => { void connectRealtime(); void loadNotifications(); }}>Подключить снова</button>
  {/if}
  <div class="inbox-list" aria-busy={loading || busy}>
    {#each items as item (item.id)}
      <article class:inbox-card--unread={item.unread} class="inbox-card">
        <div>
          <strong>{item.title}</strong>
          <p>{item.body}</p>
          <time>{item.createdLabel}</time>
          <span class="read-state">{item.unread ? 'Не прочитано' : 'Прочитано'}</span>
          {#if item.destination}<a class="notification-link" href={item.destination.href}>{item.destination.label}</a>{/if}
        </div>
        {#if item.unread}<button type="button" disabled={busy} aria-label={`Отметить прочитанным: ${item.title}`} on:click={() => markRead(item.id)}>Прочитано</button>{/if}
      </article>
    {/each}
  </div>
  {#if loading}
    <p class="page-empty-state" role="status">Загружаем уведомления…</p>
  {:else if !scopeKey}
    <p class="page-empty-state"><a href="/app/family">Выберите семью и профиль</a>, чтобы открыть уведомления.</p>
  {:else if !error && records.length === 0}
    <p class="page-empty-state">{unreadOnly ? 'Непрочитанных уведомлений нет.' : 'Уведомлений пока нет.'}</p>
  {/if}
  {#if scopeKey && !error}
    <div class="inbox-toolbar">
      <button class="button button--soft" type="button" disabled={loading || busy} on:click={() => loadNotifications()}>Обновить</button>
      {#if hasMore}<button class="button button--soft" type="button" disabled={loading || busy} on:click={() => loadNotifications(page + 1)}>Показать ещё</button>{/if}
    </div>
  {/if}
{/snippet}

<MobileShell {activeRoute} labelledBy="notifications-title-mobile">
  <section class="assignments-page">
    <header class="top-row"><div><p class="section-kicker">Входящие</p><h1 id="notifications-title-mobile">Уведомления</h1></div></header>
    {@render inboxContent()}
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="notifications-title-desktop">
  <section class="assignments-page assignments-page--desktop">
    <header class="desktop-header"><h1 id="notifications-title-desktop">Уведомления</h1></header>
    {@render inboxContent()}
  </section>
</DesktopShell>

<style>
  .inbox-toolbar, .inbox-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .inbox-toolbar { margin-block: 1rem; }
  .inbox-filters button[aria-pressed='true'] { outline: 2px solid var(--color-green); outline-offset: -2px; }
  .inbox-card { flex-wrap: wrap; overflow-wrap: anywhere; }
  .inbox-card > div { min-width: 0; flex: 1 1 12rem; }
  .read-state { font-size: 0.8rem; color: var(--color-text-muted); }
  .notification-link { display: inline-flex; align-items: center; min-height: 44px; text-decoration: underline; }
</style>

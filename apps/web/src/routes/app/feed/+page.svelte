<script lang="ts">
  import { onMount } from 'svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import { listActivity, subscribeActivity } from '$lib/api/activity.api';
  import { mapActivityToFeedItem, type FeedViewItem } from '$lib/assignments/assignments-view';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';

  const activeRoute = '/app/feed';
  const pageSize = 30;
  let familyState: FamilyState;
  let items: FeedViewItem[] = [];
  let loading = true;
  let error: string | null = null;
  let realtimeError = false;
  let page = 0;
  let hasMore = false;
  let failedPage = 1;
  let scope = 0;
  let request = 0;
  let subscription = 0;
  let scopeKey: string | null = null;
  let stopRealtime: (() => void) | undefined;

  async function loadFeed(nextPage = 1): Promise<void> {
    const context = familyState?.status === 'ready' ? getActiveFamilyContext(familyState) : null;
    if (!context || !scopeKey) return;
    const ticket = ++request;
    const currentScope = scope;
    const members = familyState.members;
    loading = true;
    error = null;
    failedPage = nextPage;
    try {
      const records = await listActivity(context, pageSize, nextPage);
      if (ticket !== request || currentScope !== scope) return;
      const incoming = records.map((record) => mapActivityToFeedItem(record, members));
      items = nextPage === 1 ? incoming : [...items, ...incoming.filter(item => !items.some(existing => existing.id === item.id))];
      page = nextPage;
      hasMore = records.length === pageSize;
    } catch {
      if (ticket === request && currentScope === scope) error = 'Не удалось загрузить ленту. Проверьте подключение и попробуйте ещё раз.';
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
      const stop = await subscribeActivity(context, () => {
        if (currentScope === scope && ticket === subscription) void loadFeed();
      });
      if (currentScope !== scope || ticket !== subscription) stop();
      else stopRealtime = stop;
    } catch {
      if (currentScope === scope && ticket === subscription) realtimeError = true;
    }
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
      stopRealtime?.();
      stopRealtime = undefined;
      items = [];
      page = 0;
      hasMore = false;
      error = state.status === 'error' ? 'Не удалось подключить семью. Откройте раздел «Семья» и повторите загрузку.' : null;
      realtimeError = false;
      loading = state.status === 'loading' || state.status === 'idle';
      if (context) {
        void loadFeed();
        void connectRealtime();
      }
    });
    return () => {
      scope += 1;
      request += 1;
      unsubscribe();
      stopRealtime?.();
    };
  });
</script>

<svelte:window on:online={() => { void loadFeed(); void connectRealtime(); }} />

{#snippet feedContent()}
  {#if error}
    <p class="today-action-message today-action-message--error" role="alert">{error}</p>
    {#if scopeKey}<button class="button button--soft" type="button" disabled={loading} on:click={() => loadFeed(failedPage)}>Повторить</button>{/if}
  {/if}
  {#if realtimeError}
    <p role="status">Автообновление недоступно.</p>
    <button class="button button--soft" type="button" on:click={() => { void connectRealtime(); void loadFeed(); }}>Подключить снова</button>
  {/if}
  <div class="feed-page-list" aria-busy={loading}>
    {#each items as item (item.id)}
      <article class={`feed-page-card feed-page-card--${item.tone}`}>
        <strong>{item.actorName}</strong>
        <p>{item.summary}</p>
        <time>{item.timeLabel}</time>
      </article>
    {/each}
  </div>
  {#if loading}
    <p class="page-empty-state" role="status">Загружаем ленту…</p>
  {:else if !scopeKey}
    <p class="page-empty-state"><a href="/app/family">Выберите семью и профиль</a>, чтобы открыть ленту.</p>
  {:else if !error && items.length === 0}
    <p class="page-empty-state">В ленте пока тихо.</p>
  {/if}
  {#if scopeKey && !error}
    <div class="feed-actions">
      <button class="button button--soft" type="button" disabled={loading} on:click={() => loadFeed()}>Обновить</button>
      {#if hasMore}<button class="button button--soft" type="button" disabled={loading} on:click={() => loadFeed(page + 1)}>Показать ещё</button>{/if}
    </div>
  {/if}
{/snippet}

<MobileShell {activeRoute} labelledBy="feed-title-mobile">
  <section class="assignments-page">
    <header class="top-row"><div><p class="section-kicker">История</p><h1 id="feed-title-mobile">Семейная лента</h1></div></header>
    {@render feedContent()}
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="feed-title-desktop">
  <section class="assignments-page assignments-page--desktop">
    <header class="desktop-header"><h1 id="feed-title-desktop">Семейная лента</h1></header>
    {@render feedContent()}
  </section>
</DesktopShell>

<style>
  .feed-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }
  .feed-page-card { overflow-wrap: anywhere; }
</style>

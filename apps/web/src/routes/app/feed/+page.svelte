<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import { listActivity } from '$lib/api/activity.api';
  import { mapActivityToFeedItem, type FeedViewItem } from '$lib/assignments/assignments-view';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';

  const activeRoute = '/app/feed';
  let familyUnsubscribe: Unsubscriber | undefined;
  let items: FeedViewItem[] = [
    {
      id: 'demo_feed',
      actorName: 'Миша',
      summary: 'Готово: Вынести мусор',
      timeLabel: 'сегодня, 10:00',
      tone: 'yellow'
    }
  ];
  let error: string | null = null;

  async function loadFeed(familyState: FamilyState | undefined): Promise<void> {
    const context = familyState ? getActiveFamilyContext(familyState) : null;
    if (!context || familyState?.status !== 'ready') return;

    try {
      const records = await listActivity(context, 50);
      items = records.map((record) => mapActivityToFeedItem(record, familyState.members));
      error = null;
    } catch (loadError) {
      console.warn('Failed to load activity feed.', loadError);
      error = 'Не удалось загрузить ленту. Показываем сохранённый пример.';
    }
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((familyState) => {
      void loadFeed(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="feed-title-mobile">
  <section class="assignments-page">
    <header class="top-row">
      <div>
        <p class="section-kicker">История</p>
        <h1 id="feed-title-mobile">Семейная лента</h1>
      </div>
    </header>
    {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}
    <div class="feed-page-list">
      {#if items.length > 0}
        {#each items as item (item.id)}
          <article class={`feed-page-card feed-page-card--${item.tone}`}>
            <strong>{item.actorName}</strong>
            <p>{item.summary}</p>
            <time>{item.timeLabel}</time>
          </article>
        {/each}
      {:else}
        <p class="page-empty-state">В ленте пока тихо.</p>
      {/if}
    </div>
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="feed-title-desktop">
  <section class="assignments-page assignments-page--desktop">
    <header class="desktop-header">
      <div>
        <h1 id="feed-title-desktop">Семейная лента</h1>
        <p class="offline-note">Кто что создал, выполнил, подтвердил или вернул.</p>
      </div>
    </header>
    {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}
    <div class="feed-page-list feed-page-list--desktop">
      {#if items.length > 0}
        {#each items as item (item.id)}
          <article class={`feed-page-card feed-page-card--${item.tone}`}>
            <strong>{item.actorName}</strong>
            <p>{item.summary}</p>
            <time>{item.timeLabel}</time>
          </article>
        {/each}
      {:else}
        <p class="page-empty-state">В ленте пока тихо.</p>
      {/if}
    </div>
  </section>
</DesktopShell>

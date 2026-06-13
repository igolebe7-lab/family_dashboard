<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import {
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead
  } from '$lib/api/notifications.api';
  import { mapNotificationInboxItem, type NotificationInboxItem } from '$lib/assignments/assignments-view';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';

  const activeRoute = '/app/today';
  let familyUnsubscribe: Unsubscriber | undefined;
  let currentFamilyState: FamilyState | undefined;
  let items: NotificationInboxItem[] = [
    {
      id: 'demo_note',
      title: 'Поручение ждёт проверки',
      body: 'Вынести мусор',
      createdLabel: 'сегодня, 10:00',
      unread: true,
      actionLabel: 'Открыть поручение'
    }
  ];
  let busy = false;
  let message: string | null = null;
  let error: string | null = null;

  async function loadNotifications(familyState: FamilyState | undefined): Promise<void> {
    const context = familyState ? getActiveFamilyContext(familyState) : null;
    if (!context || familyState?.status !== 'ready') return;

    try {
      const records = await listNotifications(context);
      items = records.map(mapNotificationInboxItem);
      error = null;
    } catch (loadError) {
      console.warn('Failed to load notifications.', loadError);
      error = 'Не удалось загрузить уведомления. Показываем сохранённый пример.';
    }
  }

  async function markOneRead(item: NotificationInboxItem): Promise<void> {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context) return;

    busy = true;
    error = null;
    try {
      await markNotificationRead(item.id, context);
      message = 'Уведомление отмечено прочитанным.';
      await loadNotifications(currentFamilyState);
    } catch (readError) {
      console.warn('Failed to mark notification read.', readError);
      error = 'Не удалось отметить уведомление.';
    } finally {
      busy = false;
    }
  }

  async function markAllRead(): Promise<void> {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context) return;

    busy = true;
    error = null;
    try {
      await markAllNotificationsRead(context);
      message = 'Все уведомления прочитаны.';
      await loadNotifications(currentFamilyState);
    } catch (readError) {
      console.warn('Failed to mark notifications read.', readError);
      error = 'Не удалось отметить уведомления.';
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((familyState) => {
      currentFamilyState = familyState;
      void loadNotifications(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="notifications-title-mobile">
  <section class="assignments-page">
    <header class="top-row">
      <div>
        <p class="section-kicker">Входящие</p>
        <h1 id="notifications-title-mobile">Уведомления</h1>
      </div>
      <button class="button button--soft" type="button" disabled={busy} on:click={markAllRead}>Прочитано</button>
    </header>
    {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}
    {#if message}<p class="today-action-message">{message}</p>{/if}
    <div class="inbox-list">
      {#if items.length > 0}
        {#each items as item (item.id)}
          <article class:inbox-card--unread={item.unread} class="inbox-card">
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <time>{item.createdLabel}</time>
            </div>
            <button type="button" disabled={busy || !item.unread} on:click={() => markOneRead(item)}>
              {item.unread ? 'Прочитано' : 'Готово'}
            </button>
          </article>
        {/each}
      {:else}
        <p class="page-empty-state">Новых уведомлений нет.</p>
      {/if}
    </div>
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="notifications-title-desktop">
  <section class="assignments-page assignments-page--desktop">
    <header class="desktop-header">
      <div>
        <h1 id="notifications-title-desktop">Уведомления</h1>
        <p class="offline-note">Мягкие напоминания, подтверждения и семейные обновления.</p>
      </div>
      <button class="button button--soft" type="button" disabled={busy} on:click={markAllRead}>Отметить все</button>
    </header>
    {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}
    {#if message}<p class="today-action-message">{message}</p>{/if}
    <div class="inbox-list">
      {#if items.length > 0}
        {#each items as item (item.id)}
          <article class:inbox-card--unread={item.unread} class="inbox-card">
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <time>{item.createdLabel}</time>
            </div>
            <button type="button" disabled={busy || !item.unread} on:click={() => markOneRead(item)}>
              {item.unread ? 'Прочитано' : 'Готово'}
            </button>
          </article>
        {/each}
      {:else}
        <p class="page-empty-state">Новых уведомлений нет.</p>
      {/if}
    </div>
  </section>
</DesktopShell>

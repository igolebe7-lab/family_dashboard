<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
  import LogOut from '@lucide/svelte/icons/log-out';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import { getIcon, type IconName } from '$lib/design/icon-registry';
  import { APP_ROUTE_DEFINITIONS, desktopNavigation } from '$lib/constants/routes';
  import { logout } from '$lib/api/auth.api';
  import { familyStore } from '$lib/stores/family.store';
  import { sessionStore, type SessionState } from '$lib/stores/session.store';

  export let activeRoute: string;

  let sessionState: SessionState | undefined;
  let sessionUnsubscribe: Unsubscriber | undefined;

  $: accountLabel =
    sessionState?.user?.name || sessionState?.user?.email?.split('@')[0] || 'Аккаунт';
  $: accountEmail = sessionState?.user?.email ?? '';

  async function handleLogout(): Promise<void> {
    logout();
    sessionStore.clear();
    familyStore.clear();
    await goto('/login', { replaceState: true });
  }

  onMount(() => {
    sessionUnsubscribe = sessionStore.subscribe((state) => {
      sessionState = state;
    });
  });

  onDestroy(() => {
    sessionUnsubscribe?.();
  });
</script>

<aside class="sidebar" aria-label="Разделы приложения">
  <a class="brand-mark" href="/app/today" aria-label="FamilyTime сегодня">
    <span class="brand-mark__icon">F</span>
    <span>FamilyTime</span>
  </a>

  <nav class="sidebar-nav">
    {#each desktopNavigation as item}
      {@const Icon = getIcon(item.icon as IconName)}
      <a
        class:sidebar-nav__item--active={item.href === activeRoute}
        class="sidebar-nav__item"
        href={item.href}
        aria-current={item.href === activeRoute ? 'page' : undefined}
      >
        <Icon size={21} aria-hidden="true" />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <section class="sidebar-family" aria-label="Семья">
    <p>Семья</p>
    <div class="sidebar-family__list">
      <span class="sidebar-family__member sidebar-family__member--lavender">
        <span class="sidebar-family__avatar portrait portrait--mom" aria-hidden="true">
          <span class="portrait__face">М</span>
        </span>
        <span class="sidebar-family__name">Мама</span>
        <span class="sidebar-family__dot" aria-hidden="true"></span>
      </span>
      <span class="sidebar-family__member sidebar-family__member--blue">
        <span class="sidebar-family__avatar portrait portrait--dad" aria-hidden="true">
          <span class="portrait__face">П</span>
        </span>
        <span class="sidebar-family__name">Папа</span>
        <span class="sidebar-family__dot" aria-hidden="true"></span>
      </span>
      <span class="sidebar-family__member sidebar-family__member--green">
        <span class="sidebar-family__avatar portrait portrait--misha" aria-hidden="true">
          <span class="portrait__face">М</span>
        </span>
        <span class="sidebar-family__name">Миша</span>
        <span class="sidebar-family__dot" aria-hidden="true"></span>
      </span>
      <span class="sidebar-family__member sidebar-family__member--peach">
        <span class="sidebar-family__avatar portrait portrait--anya" aria-hidden="true">
          <span class="portrait__face">А</span>
        </span>
        <span class="sidebar-family__name">Аня</span>
        <span class="sidebar-family__dot" aria-hidden="true"></span>
      </span>
    </div>
  </section>

  <section class="family-progress" aria-label="Семейный прогресс">
    <div class="family-progress__title">
      <p>Семейный прогресс</p>
      <ChevronRight size={17} strokeWidth={2.35} aria-hidden="true" />
    </div>
    <strong>Отличная работа! 🎉</strong>
    <div class="family-progress__bar">
      <span class="progress-line" aria-hidden="true"><span></span></span>
      <span>78%</span>
    </div>
  </section>

  <section class="sidebar-account" aria-label="Аккаунт">
    <a
      class:sidebar-account__profile--active={activeRoute === APP_ROUTE_DEFINITIONS.profile.href}
      class="sidebar-account__profile"
      href={APP_ROUTE_DEFINITIONS.profile.href}
      aria-current={activeRoute === APP_ROUTE_DEFINITIONS.profile.href ? 'page' : undefined}
    >
      <CircleUserRound size={20} aria-hidden="true" />
      <span>
        <strong>{accountLabel}</strong>
        {#if accountEmail}<small>{accountEmail}</small>{/if}
      </span>
    </a>
    <button class="sidebar-account__logout" type="button" on:click={handleLogout}>
      <LogOut size={18} aria-hidden="true" />
      <span>Выйти</span>
    </button>
  </section>
</aside>

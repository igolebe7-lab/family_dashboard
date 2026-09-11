<script lang="ts">
  import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
  import LogOut from '@lucide/svelte/icons/log-out';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import { getIcon, type IconName } from '$lib/design/icon-registry';
  import { APP_ROUTE_DEFINITIONS, desktopNavigation } from '$lib/constants/routes';
  import { logout } from '$lib/api/auth.api';
  import { familyStore, type FamilyState } from '$lib/stores/family.store';
  import { sessionStore, type SessionState } from '$lib/stores/session.store';

  export let activeRoute: string;

  let sessionState: SessionState | undefined;
  let familyState: FamilyState | undefined;
  let sessionUnsubscribe: Unsubscriber | undefined;
  let familyUnsubscribe: Unsubscriber | undefined;

  $: accountLabel =
    sessionState?.user?.name || sessionState?.user?.email?.split('@')[0] || 'Аккаунт';
  $: accountEmail = sessionState?.user?.email ?? '';
  $: familyMembers = (familyState?.members ?? []).filter((member) => member.active).slice(0, 5);
  $: familyName = familyState?.activeFamily?.name ?? 'Семья';

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
    familyUnsubscribe = familyStore.subscribe((state) => {
      familyState = state;
    });
  });

  onDestroy(() => {
    sessionUnsubscribe?.();
    familyUnsubscribe?.();
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

  {#if familyMembers.length > 0}
    <section class="sidebar-family" aria-label="Семья">
      <p>{familyName}</p>
      <div class="sidebar-family__list">
        {#each familyMembers as member (member.id)}
          <span class={`sidebar-family__member sidebar-family__member--${member.colorKey ?? 'green'}`}>
            <span class="sidebar-family__avatar" aria-hidden="true">
              {member.displayName.charAt(0).toUpperCase()}
            </span>
            <span class="sidebar-family__name">{member.displayName}</span>
            <span class="sidebar-family__dot" aria-hidden="true"></span>
          </span>
        {/each}
      </div>
    </section>
  {/if}

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

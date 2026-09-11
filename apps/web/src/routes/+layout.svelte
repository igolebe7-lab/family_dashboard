<script lang="ts">
  import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { onDestroy, onMount } from 'svelte';
  import { get, type Unsubscriber } from 'svelte/store';
  import { getCurrentSession } from '$lib/api/auth.api';
  import ConnectionStatus from '$lib/components/app/ConnectionStatus.svelte';
  import { bootstrapClientApp, clearDevelopmentShell, isProtectedAppRoute, resolveAppRouteRedirect, watchClientSession } from '$lib/stores/app.bootstrap';
  import { familyStore, getActiveFamilyContext } from '$lib/stores/family.store';
  import { sessionStore } from '$lib/stores/session.store';
  import '../app.css';
  import '$lib/design/workspace.css';

  let unsubscribeAuth: Unsubscriber | undefined;
  let mounted = false;
  let destroyed = false;
  let guardVersion = 0;
  let checked = false;
  let bootstrapError = '';

  beforeNavigate(() => {
    guardVersion += 1;
  });
  afterNavigate(() => {
    // SvelteKit clears the navigating store after afterNavigate callbacks.
    queueMicrotask(() => {
      if (mounted && !destroyed) void guardRoute(get(page).url.pathname);
    });
  });

  $: protectedRoute = isProtectedAppRoute($page.url.pathname);
  $: redirect = resolveAppRouteRedirect({
    pathname: $page.url.pathname,
    isAuthenticated: $sessionStore.isAuthenticated,
    hasFamilyContext: Boolean(getActiveFamilyContext($familyStore))
  });
  $: canRender = !protectedRoute || (checked && $sessionStore.status === 'ready' &&
    $familyStore.status === 'ready' && !redirect);

  async function redirectIfNeeded(pathname: string, hasFamilyContext: boolean): Promise<void> {
    const redirect = resolveAppRouteRedirect({
      pathname,
      isAuthenticated: get(sessionStore).isAuthenticated,
      hasFamilyContext
    });

    if (redirect && redirect !== pathname) {
      await goto(redirect, { replaceState: true });
    }
  }

  async function guardRoute(pathname: string, force = false): Promise<void> {
    if (get(navigating)) return;
    const version = (guardVersion += 1);
    if (!isProtectedAppRoute(pathname)) return;
    bootstrapError = '';
    const session = get(sessionStore);
    const family = get(familyStore);
    const auth = getCurrentSession();

    if (!force && auth?.user.id === session.user?.id && auth && session.status === 'ready' && family.status === 'ready') {
      await redirectIfNeeded(pathname, Boolean(getActiveFamilyContext(family)));
      if (version === guardVersion) checked = true;
      return;
    }

    checked = false;
    try {
      const context = await bootstrapClientApp();
      if (version !== guardVersion) return;
      await redirectIfNeeded(pathname, Boolean(context));
      if (version === guardVersion) checked = true;
    } catch (error) {
      if (version !== guardVersion) return;
      console.warn('Failed to bootstrap FamilyTime session.', error);
      if (!getCurrentSession()) {
        await goto('/login', { replaceState: true });
      } else {
        bootstrapError = 'Не удалось загрузить семейные данные. Проверьте подключение и попробуйте ещё раз.';
      }
    }
  }

  onMount(() => {
    void initialize();
  });

  async function initialize(): Promise<void> {
    try {
      const reload = await clearDevelopmentShell();
      if (destroyed) return;
      if (reload && !sessionStorage.getItem('familytime-dev-sw-reloaded')) {
        sessionStorage.setItem('familytime-dev-sw-reloaded', '1');
        window.location.reload();
        return;
      }
      if (import.meta.env.DEV && !reload) sessionStorage.removeItem('familytime-dev-sw-reloaded');
    } catch (error) {
      console.warn('Failed to clean up development shell cache.', error);
    }
    if (destroyed) return;
    mounted = true;
    unsubscribeAuth = watchClientSession(sessionStore, familyStore, undefined, () => {
      checked = false;
      void guardRoute(get(page).url.pathname);
    });
    void guardRoute(get(page).url.pathname);
  }

  onDestroy(() => {
    destroyed = true;
    unsubscribeAuth?.();
    guardVersion += 1;
  });
</script>

<svelte:head>
  <title>FamilyTime</title>
  <meta
    name="description"
    content="Семейный календарь, дела и поручения для спокойной координации дня."
  />
</svelte:head>

<ConnectionStatus />

{#if canRender}
  <slot />
{:else}
  <main class="auth-bootstrap" aria-busy={!bootstrapError}>
    {#if bootstrapError}
      <p role="alert">{bootstrapError}</p>
      <button class="button button--primary" type="button" on:click={() => guardRoute($page.url.pathname, true)}>
        Попробовать снова
      </button>
      <a class="primary-link" href="/login">Вернуться ко входу</a>
    {:else}
      <p role="status">Загружаем семейный день…</p>
    {/if}
  </main>
{/if}

<style>
  .auth-bootstrap {
    min-height: 100dvh;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 1rem;
    padding: 1.5rem;
    text-align: center;
  }
  .auth-bootstrap p { max-width: 32rem; }
</style>

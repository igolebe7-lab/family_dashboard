<script lang="ts">
  import LogOut from '@lucide/svelte/icons/log-out';
  import Save from '@lucide/svelte/icons/save';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import ThemeSettings from '$lib/components/app/ThemeSettings.svelte';
  import {
    getAuthErrorMessage,
    logout,
    requestPasswordReset,
    updateCurrentUserPassword,
    updateCurrentUserProfile
  } from '$lib/api/auth.api';
  import { familyStore } from '$lib/stores/family.store';
  import { sessionStore, type SessionState } from '$lib/stores/session.store';

  const activeRoute = '/app/profile';

  let sessionUnsubscribe: Unsubscriber | undefined;
  let sessionState: SessionState | undefined;
  let name = '';
  let email = '';
  let oldPassword = '';
  let password = '';
  let passwordConfirm = '';
  let profileSaving = false;
  let passwordSaving = false;
  let resetRequestSaving = false;
  let profileMessage: string | null = null;
  let passwordMessage: string | null = null;
  let profileError: string | null = null;
  let passwordError: string | null = null;

  $: currentUser = sessionState?.user ?? null;
  $: profileTone = $familyStore.members.find(member => member.user === currentUser?.id)?.colorKey || 'blue';

  async function submitProfile(): Promise<void> {
    if (!currentUser || !sessionState?.token) {
      profileError = 'Нужно войти в аккаунт.';
      return;
    }

    const nextName = name.trim();
    const nextEmail = email.trim();

    if (!nextEmail) {
      profileError = 'Введите email аккаунта.';
      return;
    }

    profileSaving = true;
    profileError = null;
    profileMessage = null;

    try {
      await updateCurrentUserProfile({
        name: nextName,
        email: nextEmail
      });
      profileMessage = 'Данные профиля сохранены.';
    } catch (error) {
      profileError = getAuthErrorMessage(
        error,
        'Не удалось сохранить профиль. Проверьте email и подключение.'
      );
      console.warn('Failed to update profile.', error);
    } finally {
      profileSaving = false;
    }
  }

  async function submitPassword(): Promise<void> {
    if (!currentUser || !sessionState?.token) {
      passwordError = 'Нужно войти в аккаунт.';
      return;
    }

    if (!oldPassword || !password || !passwordConfirm) {
      passwordError = 'Заполните старый пароль, новый пароль и подтверждение.';
      return;
    }

    if (password !== passwordConfirm) {
      passwordError = 'Новый пароль и подтверждение не совпадают.';
      return;
    }

    passwordSaving = true;
    passwordError = null;
    passwordMessage = null;

    try {
      await updateCurrentUserPassword({
        oldPassword,
        password,
        passwordConfirm
      });
      oldPassword = '';
      password = '';
      passwordConfirm = '';
      // The root session guard owns navigation after credential invalidation.
    } catch (error) {
      passwordError = getAuthErrorMessage(
        error,
        'Не удалось обновить пароль. Проверьте старый пароль.'
      );
      console.warn('Failed to update password.', error);
    } finally {
      passwordSaving = false;
    }
  }

  async function requestResetEmail(): Promise<void> {
    if (!currentUser?.email) {
      passwordError = 'Email аккаунта не загружен.';
      return;
    }

    resetRequestSaving = true;
    passwordError = null;
    passwordMessage = null;

    try {
      await requestPasswordReset(currentUser.email);
      passwordMessage = 'Если аккаунт найден, ссылка для сброса пароля отправлена на email.';
    } catch (error) {
      passwordError = getAuthErrorMessage(error, 'Не удалось отправить письмо для сброса пароля.');
      console.warn('Failed to request password reset.', error);
    } finally {
      resetRequestSaving = false;
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    sessionStore.clear();
    familyStore.clear();
    await goto('/login', { replaceState: true });
  }

  onMount(() => {
    sessionUnsubscribe = sessionStore.subscribe((state) => {
      const previousUserId = sessionState?.user?.id;
      sessionState = state;

      if (state.user && state.user.id !== previousUserId) {
        name = state.user.name;
        email = state.user.email;
      }
    });
  });

  onDestroy(() => {
    sessionUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="profile-title-mobile">
  <section class="profile-page">
    <header class="top-row">
      <div>
        <p class="section-kicker">Аккаунт</p>
        <h1 id="profile-title-mobile">Профиль</h1>
      </div>
    </header>

    <section class="profile-summary" aria-label="Текущий аккаунт">
      <span class="profile-summary__avatar" style:color={`var(--color-${profileTone})`} style:background={`var(--color-${profileTone}-soft)`} aria-hidden="true">
        {(currentUser?.name || currentUser?.email || 'А').charAt(0).toUpperCase()}
      </span>
      <div>
        <strong>{currentUser?.name || 'Ваш аккаунт'}</strong>
        <p>{currentUser?.email || 'Email не загружен'}</p>
      </div>
    </section>

    <ThemeSettings id="theme-mobile" />
    <form class="family-panel family-form profile-form" on:submit|preventDefault={submitProfile}>
      <h2>Данные профиля</h2>
      {#if profileError}<p class="family-message family-message--error">{profileError}</p>{/if}
      {#if profileMessage}<p class="family-message family-message--success">{profileMessage}</p>{/if}
      <label>
        <span>Имя</span>
        <input bind:value={name} maxlength="80" autocomplete="name" placeholder="Мама" />
      </label>
      <label>
        <span>Email</span>
        <input bind:value={email} type="email" autocomplete="email" placeholder="you@example.com" />
      </label>
      <button class="button button--primary" disabled={profileSaving} type="submit">
        <Save size={18} strokeWidth={2.35} aria-hidden="true" />
        {profileSaving ? 'Сохраняем' : 'Сохранить'}
      </button>
    </form>

    <form class="family-panel family-form profile-form" on:submit|preventDefault={submitPassword}>
      <h2>Пароль</h2>
      {#if passwordError}<p class="family-message family-message--error">{passwordError}</p>{/if}
      {#if passwordMessage}<p class="family-message family-message--success">{passwordMessage}</p>{/if}
      <label>
        <span>Старый пароль</span>
        <input bind:value={oldPassword} type="password" autocomplete="current-password" />
      </label>
      <label>
        <span>Новый пароль</span>
        <input bind:value={password} type="password" autocomplete="new-password" minlength="8" />
      </label>
      <label>
        <span>Повторите новый пароль</span>
        <input bind:value={passwordConfirm} type="password" autocomplete="new-password" minlength="8" />
      </label>
      <button class="button button--ghost" disabled={passwordSaving} type="submit">
        <ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />
        {passwordSaving ? 'Обновляем' : 'Обновить пароль'}
      </button>
      <button class="button button--ghost" disabled={resetRequestSaving} type="button" on:click={requestResetEmail}>
        {resetRequestSaving ? 'Отправляем' : 'Отправить ссылку сброса'}
      </button>
    </form>

    <a class="button button--ghost" href="/app/settings/notifications">Уведомления и установка</a>
    <button class="profile-logout" type="button" on:click={handleLogout}>
      <LogOut size={18} strokeWidth={2.35} aria-hidden="true" />
      <span>Выйти из аккаунта</span>
    </button>
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="profile-title-desktop">
  <section class="profile-page profile-page--desktop">
    <header class="desktop-header">
      <div>
        <h1 id="profile-title-desktop">Профиль</h1>
        <p class="offline-note">Данные аккаунта, пароль и выход из текущей сессии.</p>
      </div>
    </header>

    <section class="profile-summary" aria-label="Текущий аккаунт">
      <span class="profile-summary__avatar" style:color={`var(--color-${profileTone})`} style:background={`var(--color-${profileTone}-soft)`} aria-hidden="true">
        {(currentUser?.name || currentUser?.email || 'А').charAt(0).toUpperCase()}
      </span>
      <div>
        <strong>{currentUser?.name || 'Ваш аккаунт'}</strong>
        <p>{currentUser?.email || 'Email не загружен'}</p>
      </div>
    </section>

    <form class="family-panel family-form profile-form" on:submit|preventDefault={submitProfile}>
      <h2>Данные профиля</h2>
      {#if profileError}<p class="family-message family-message--error">{profileError}</p>{/if}
      {#if profileMessage}<p class="family-message family-message--success">{profileMessage}</p>{/if}
      <label>
        <span>Имя</span>
        <input bind:value={name} maxlength="80" autocomplete="name" placeholder="Мама" />
      </label>
      <label>
        <span>Email</span>
        <input bind:value={email} type="email" autocomplete="email" placeholder="you@example.com" />
      </label>
      <button class="button button--primary" disabled={profileSaving} type="submit">
        <Save size={18} strokeWidth={2.35} aria-hidden="true" />
        {profileSaving ? 'Сохраняем' : 'Сохранить'}
      </button>
    </form>
  </section>

  <svelte:fragment slot="aside">
    <form class="family-panel family-form profile-form" on:submit|preventDefault={submitPassword}>
      <h2>Пароль</h2>
      {#if passwordError}<p class="family-message family-message--error">{passwordError}</p>{/if}
      {#if passwordMessage}<p class="family-message family-message--success">{passwordMessage}</p>{/if}
      <label>
        <span>Старый пароль</span>
        <input bind:value={oldPassword} type="password" autocomplete="current-password" />
      </label>
      <label>
        <span>Новый пароль</span>
        <input bind:value={password} type="password" autocomplete="new-password" minlength="8" />
      </label>
      <label>
        <span>Повторите новый пароль</span>
        <input bind:value={passwordConfirm} type="password" autocomplete="new-password" minlength="8" />
      </label>
      <button class="button button--ghost" disabled={passwordSaving} type="submit">
        <ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />
        {passwordSaving ? 'Обновляем' : 'Обновить пароль'}
      </button>
      <button class="button button--ghost" disabled={resetRequestSaving} type="button" on:click={requestResetEmail}>
        {resetRequestSaving ? 'Отправляем' : 'Отправить ссылку сброса'}
      </button>
    </form>

    <ThemeSettings id="theme-desktop" />
    <a class="button button--ghost" href="/app/settings/notifications">Уведомления и установка</a>
    <button class="profile-logout" type="button" on:click={handleLogout}>
      <LogOut size={18} strokeWidth={2.35} aria-hidden="true" />
      <span>Выйти из аккаунта</span>
    </button>
  </svelte:fragment>
</DesktopShell>

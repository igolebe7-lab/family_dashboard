<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getCurrentSession } from '$lib/api/auth.api';
  import {
    acceptInvitation,
    getInvitationPreview,
    type AcceptInvitationResult
  } from '$lib/api/invitations.api';
  import { bootstrapClientApp } from '$lib/stores/app.bootstrap';
  import type { InvitationRecord } from '$lib/types/domain';

  $: code = $page.params.code ?? '';

  let invitation: InvitationRecord | null = null;
  let accepted: AcceptInvitationResult | null = null;
  let loading = true;
  let accepting = false;
  let errorMessage = '';
  let needsLogin = false;

  async function loadInvitation(): Promise<void> {
    loading = true;
    errorMessage = '';
    needsLogin = !getCurrentSession();

    if (needsLogin) {
      loading = false;
      return;
    }

    if (!code) {
      errorMessage = 'Код приглашения не указан.';
      loading = false;
      return;
    }

    try {
      invitation = await getInvitationPreview(code);
    } catch (error) {
      console.warn('Failed to load invitation.', error);
      errorMessage = 'Приглашение не найдено или срок истёк.';
    } finally {
      loading = false;
    }
  }

  async function accept(): Promise<void> {
    accepting = true;
    errorMessage = '';

    if (!code) {
      errorMessage = 'Код приглашения не указан.';
      accepting = false;
      return;
    }

    try {
      accepted = await acceptInvitation(code);
      await bootstrapClientApp();
    } catch (error) {
      console.warn('Failed to accept invitation.', error);
      errorMessage = 'Не удалось принять приглашение.';
    } finally {
      accepting = false;
    }
  }

  onMount(() => {
    void loadInvitation();
  });
</script>

<main class="auth-screen" aria-labelledby="invite-title">
  <section class="auth-panel">
    <div class="auth-panel__copy">
      <p class="eyebrow">Приглашение</p>
      <h1 id="invite-title">Войти в семью</h1>
      <p>Свяжите этот аккаунт с семейным профилем.</p>
    </div>

    {#if loading}
      <p class="composer-message">Проверяем приглашение.</p>
    {:else if needsLogin}
      <p class="composer-message composer-message--error">Сначала войдите или создайте аккаунт, затем вернитесь по этой ссылке.</p>
      <div class="auth-link-row">
        <a class="button button--primary" href="/login">Войти</a>
        <a class="button button--soft" href={`/register?invite=${encodeURIComponent(code)}`}>Создать аккаунт</a>
      </div>
    {:else if accepted}
      <p class="composer-message composer-message--success">Профиль связан: {accepted.member.displayName}.</p>
      <button class="button button--primary auth-form__submit" type="button" on:click={() => goto('/app/today')}>
        Открыть семью
      </button>
    {:else}
      {#if errorMessage}
        <p class="composer-message composer-message--error" role="alert">{errorMessage}</p>
      {/if}
      {#if invitation}
        <p class="composer-message">Роль: {invitation.role}. Код действует до {new Date(invitation.expiresAt).toLocaleDateString('ru-RU')}.</p>
        <button class="button button--primary auth-form__submit" disabled={accepting} type="button" on:click={accept}>
          {accepting ? 'Связываем' : 'Принять приглашение'}
        </button>
      {/if}
    {/if}
  </section>
</main>

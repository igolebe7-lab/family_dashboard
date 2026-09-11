<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    getAuthErrorMessage,
    login,
    requestPasswordReset
  } from '$lib/api/auth.api';
  import { bootstrapClientApp } from '$lib/stores/app.bootstrap';

  let email = '';
  let password = '';
  let loading = false;
  let resetLoading = false;
  let errorMessage = '';
  let resetMessage = '';

  async function submitLogin(): Promise<void> {
    if (loading) return;
    errorMessage = '';

    if (!email.trim() || !password) {
      errorMessage = 'Введите email и пароль.';
      return;
    }

    loading = true;

    try {
      await login({
        email: email.trim(),
        password
      });
      const context = await bootstrapClientApp();
      await goto(context ? '/app/today' : '/app/onboarding', { replaceState: true });
    } catch (error) {
      console.warn('Failed to login.', error);
      errorMessage = getAuthErrorMessage(
        error,
        'Не удалось войти. Проверьте email, пароль и подключение к серверу.'
      );
    } finally {
      loading = false;
    }
  }

  async function submitPasswordReset(): Promise<void> {
    errorMessage = '';
    resetMessage = '';

    if (!email.trim()) {
      errorMessage = 'Введите email, чтобы отправить ссылку для сброса пароля.';
      return;
    }

    resetLoading = true;

    try {
      await requestPasswordReset(email.trim());
      resetMessage = 'Если аккаунт найден, ссылка для сброса пароля отправлена на email.';
    } catch (error) {
      console.warn('Failed to request password reset.', error);
      errorMessage = getAuthErrorMessage(error, 'Не удалось отправить письмо для сброса пароля.');
    } finally {
      resetLoading = false;
    }
  }
</script>

<main class="auth-screen" aria-labelledby="login-title">
  <section class="auth-panel">
    <div class="auth-panel__copy">
      <p class="eyebrow">FamilyTime</p>
      <h1 id="login-title">Вход в семейный день</h1>
      <p>Откройте расписание, дела и поручения вашей семьи.</p>
    </div>

    {#if errorMessage}
      <p class="composer-message composer-message--error" role="alert">{errorMessage}</p>
    {/if}
    {#if resetMessage}
      <p class="composer-message composer-message--success">{resetMessage}</p>
    {/if}

    <form class="auth-form" on:submit|preventDefault={submitLogin}>
      <label>
        <span>Email</span>
        <input
          bind:value={email}
          autocomplete="email"
          inputmode="email"
          name="email"
          placeholder="parent@example.com"
          type="email"
        />
      </label>

      <label>
        <span>Пароль</span>
        <input
          bind:value={password}
          autocomplete="current-password"
          name="password"
          placeholder="Введите пароль"
          type="password"
        />
      </label>

      <button class="button button--primary auth-form__submit" disabled={loading} type="submit">
        {loading ? 'Входим' : 'Войти'}
      </button>
      <div class="auth-link-row">
        <a class="primary-link" href="/register">Создать аккаунт и семью</a>
        <button class="button button--ghost" disabled={resetLoading} type="button" on:click={submitPasswordReset}>
          {resetLoading ? 'Отправляем' : 'Сбросить пароль'}
        </button>
      </div>
    </form>
  </section>
</main>

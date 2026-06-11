<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getCurrentSession, login } from '$lib/api/auth.api';
  import { bootstrapClientApp } from '$lib/stores/app.bootstrap';

  let email = '';
  let password = '';
  let loading = false;
  let errorMessage = '';

  onMount(() => {
    if (browser && getCurrentSession()) {
      void goto('/app/today', { replaceState: true });
    }
  });

  async function submitLogin(): Promise<void> {
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
      await bootstrapClientApp();
      await goto('/app/today', { replaceState: true });
    } catch (error) {
      console.warn('Failed to login.', error);
      errorMessage = 'Не удалось войти. Проверьте email, пароль и подключение к серверу.';
    } finally {
      loading = false;
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
    </form>
  </section>
</main>

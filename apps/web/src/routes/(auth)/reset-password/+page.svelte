<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAuthErrorMessage, confirmPasswordReset } from '$lib/api/auth.api';

  let password = '';
  let passwordConfirm = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';

  $: resetToken = $page.url.searchParams.get('token') ?? '';

  async function submitReset(): Promise<void> {
    errorMessage = '';
    successMessage = '';

    if (!resetToken) {
      errorMessage = 'Ссылка сброса пароля неполная.';
      return;
    }

    if (!password || !passwordConfirm) {
      errorMessage = 'Введите новый пароль и подтверждение.';
      return;
    }

    if (password !== passwordConfirm) {
      errorMessage = 'Новый пароль и подтверждение не совпадают.';
      return;
    }

    loading = true;

    try {
      await confirmPasswordReset({
        token: resetToken,
        password,
        passwordConfirm
      });
      successMessage = 'Пароль обновлён. Теперь можно войти.';
      password = '';
      passwordConfirm = '';
    } catch (error) {
      console.warn('Failed to confirm password reset.', error);
      errorMessage = getAuthErrorMessage(error, 'Не удалось обновить пароль по этой ссылке.');
    } finally {
      loading = false;
    }
  }
</script>

<main class="auth-screen" aria-labelledby="reset-password-title">
  <section class="auth-panel">
    <div class="auth-panel__copy">
      <p class="eyebrow">FamilyTime</p>
      <h1 id="reset-password-title">Новый пароль</h1>
      <p>Задайте новый пароль для аккаунта.</p>
    </div>

    {#if errorMessage}
      <p class="composer-message composer-message--error" role="alert">{errorMessage}</p>
    {/if}
    {#if successMessage}
      <p class="composer-message composer-message--success">{successMessage}</p>
    {/if}

    <form class="auth-form" on:submit|preventDefault={submitReset}>
      <label>
        <span>Новый пароль</span>
        <input bind:value={password} autocomplete="new-password" minlength="8" type="password" />
      </label>
      <label>
        <span>Повторите новый пароль</span>
        <input bind:value={passwordConfirm} autocomplete="new-password" minlength="8" type="password" />
      </label>
      <button class="button button--primary auth-form__submit" disabled={loading} type="submit">
        {loading ? 'Обновляем' : 'Обновить пароль'}
      </button>
      <button class="button button--ghost" type="button" on:click={() => goto('/login')}>
        Вернуться ко входу
      </button>
    </form>
  </section>
</main>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { login, registerAdult } from '$lib/api/auth.api';
  import { createFamilyWithOwner } from '$lib/api/families.api';
  import { familyStore } from '$lib/stores/family.store';
  import { sessionStore } from '$lib/stores/session.store';

  let ownerName = '';
  let familyName = '';
  let email = '';
  let password = '';
  let passwordConfirm = '';
  let loading = false;
  let errorMessage = '';

  $: inviteCode = $page.url.searchParams.get('invite')?.trim() ?? '';
  $: isInviteRegistration = Boolean(inviteCode);

  async function submitRegister(): Promise<void> {
    errorMessage = '';

    if (!ownerName.trim() || (!isInviteRegistration && !familyName.trim()) || !email.trim() || !password) {
      errorMessage = isInviteRegistration
        ? 'Заполните имя, email и пароль.'
        : 'Заполните имя, семью, email и пароль.';
      return;
    }

    if (password !== passwordConfirm) {
      errorMessage = 'Пароли не совпадают.';
      return;
    }

    loading = true;

    try {
      const user = await registerAdult({
        email: email.trim(),
        password,
        passwordConfirm,
        name: ownerName.trim()
      });
      const session = await login({ email: email.trim(), password });
      sessionStore.setSession(session);

      if (isInviteRegistration) {
        await goto(`/invite/${inviteCode}`, { replaceState: true });
        return;
      }

      const { family, member } = await createFamilyWithOwner({
        familyName: familyName.trim(),
        ownerName: ownerName.trim(),
        ownerUserId: user.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam'
      });
      familyStore.setFamilies([family]);
      familyStore.setMembers([member]);
      familyStore.setActiveFamily(family);
      familyStore.setActiveMember(member);
      await goto('/app/today', { replaceState: true });
    } catch (error) {
      console.warn('Failed to register family.', error);
      errorMessage = 'Не удалось зарегистрироваться или создать семью.';
    } finally {
      loading = false;
    }
  }
</script>

<main class="auth-screen" aria-labelledby="register-title">
  <section class="auth-panel">
    <div class="auth-panel__copy">
      <p class="eyebrow">FamilyTime</p>
      <h1 id="register-title">
        {isInviteRegistration ? 'Создать аккаунт для приглашения' : 'Создать семейный аккаунт'}
      </h1>
      <p>
        {isInviteRegistration
          ? 'После регистрации вы вернётесь к приглашению и сможете связать профиль.'
          : 'Первый взрослый становится владельцем семьи и сможет добавить остальных.'}
      </p>
    </div>

    {#if errorMessage}
      <p class="composer-message composer-message--error" role="alert">{errorMessage}</p>
    {/if}

    <form class="auth-form" on:submit|preventDefault={submitRegister}>
      <label>
        <span>Ваше имя</span>
        <input bind:value={ownerName} autocomplete="name" maxlength="60" placeholder="Мама" />
      </label>
      {#if !isInviteRegistration}
        <label>
          <span>Название семьи</span>
          <input bind:value={familyName} maxlength="80" placeholder="Семья Ивановых" />
        </label>
      {/if}
      <label>
        <span>Email</span>
        <input bind:value={email} autocomplete="email" inputmode="email" type="email" placeholder="parent@example.com" />
      </label>
      <label>
        <span>Пароль</span>
        <input bind:value={password} autocomplete="new-password" type="password" placeholder="Минимум 8 символов" />
      </label>
      <label>
        <span>Повтор пароля</span>
        <input bind:value={passwordConfirm} autocomplete="new-password" type="password" placeholder="Повторите пароль" />
      </label>
      <button class="button button--primary auth-form__submit" disabled={loading} type="submit">
        {loading ? 'Создаём' : isInviteRegistration ? 'Создать аккаунт' : 'Создать семью'}
      </button>
      <a class="primary-link" href="/login">Уже есть аккаунт</a>
    </form>
  </section>
</main>

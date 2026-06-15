<script lang="ts">
  import { goto } from '$app/navigation';
  import { getCurrentSession } from '$lib/api/auth.api';
  import { createFamilyWithOwner } from '$lib/api/families.api';
  import { familyStore } from '$lib/stores/family.store';

  let ownerName = '';
  let familyName = '';
  let loading = false;
  let errorMessage = '';

  async function submitFamily(): Promise<void> {
    const session = getCurrentSession();
    errorMessage = '';

    if (!session) {
      await goto('/login', { replaceState: true });
      return;
    }

    if (!ownerName.trim() || !familyName.trim()) {
      errorMessage = 'Введите имя и название семьи.';
      return;
    }

    loading = true;

    try {
      const { family, member } = await createFamilyWithOwner({
        familyName: familyName.trim(),
        ownerName: ownerName.trim(),
        ownerUserId: session.user.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam'
      });
      familyStore.setFamilies([family]);
      familyStore.setMembers([member]);
      familyStore.setActiveFamily(family);
      familyStore.setActiveMember(member);
      await goto('/app/today', { replaceState: true });
    } catch (error) {
      console.warn('Failed to create first family.', error);
      errorMessage = 'Не удалось создать семью.';
    } finally {
      loading = false;
    }
  }
</script>

<main class="auth-screen" aria-labelledby="onboarding-title">
  <section class="auth-panel">
    <div class="auth-panel__copy">
      <p class="eyebrow">Первый запуск</p>
      <h1 id="onboarding-title">Создайте семью</h1>
      <p>Это будет общий календарь, поручения и профили для ваших домашних.</p>
    </div>

    {#if errorMessage}
      <p class="composer-message composer-message--error" role="alert">{errorMessage}</p>
    {/if}

    <form class="auth-form" on:submit|preventDefault={submitFamily}>
      <label>
        <span>Ваше имя в семье</span>
        <input bind:value={ownerName} maxlength="60" placeholder="Мама" />
      </label>
      <label>
        <span>Название семьи</span>
        <input bind:value={familyName} maxlength="80" placeholder="Семья Ивановых" />
      </label>
      <button class="button button--primary auth-form__submit" disabled={loading} type="submit">
        {loading ? 'Создаём' : 'Создать семью'}
      </button>
    </form>
  </section>
</main>

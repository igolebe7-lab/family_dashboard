<script lang="ts">
  import Link2 from '@lucide/svelte/icons/link-2';
  import Plus from '@lucide/svelte/icons/plus';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import ActiveProfileSwitcher from '$lib/components/family/ActiveProfileSwitcher.svelte';
  import { createMember, listMembers, updateMember } from '$lib/api/members.api';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import { sessionStore, type SessionState } from '$lib/stores/session.store';
  import type { FamilyMember } from '$lib/types/domain';
  import type { MemberRole } from '$lib/constants/roles';

  const activeRoute = '/app/family';
  const roleOptions: Array<{ value: MemberRole; label: string }> = [
    { value: 'parent', label: 'Родитель' },
    { value: 'adult', label: 'Взрослый' },
    { value: 'teen', label: 'Подросток' },
    { value: 'child', label: 'Ребёнок' },
    { value: 'guest', label: 'Гость' }
  ];
  const colorOptions = [
    { value: 'blue', label: 'Синий' },
    { value: 'green', label: 'Зелёный' },
    { value: 'peach', label: 'Персиковый' },
    { value: 'lavender', label: 'Лавандовый' },
    { value: 'yellow', label: 'Жёлтый' }
  ];
  const roleLabelByValue = new Map(roleOptions.map((option) => [option.value, option.label]));

  let familyUnsubscribe: Unsubscriber | undefined;
  let sessionUnsubscribe: Unsubscriber | undefined;
  let familyState: FamilyState | undefined;
  let sessionState: SessionState | undefined;
  let displayName = 'Папа';
  let role: MemberRole = 'parent';
  let colorKey = 'blue';
  let saving = false;
  let error: string | null = null;
  let success: string | null = null;

  $: context = familyState ? getActiveFamilyContext(familyState) : null;
  $: currentUserId = sessionState?.user?.id;
  $: canSwitchActiveProfile = canAuthenticatedAdultSwitchProfiles(
    familyState?.members ?? [],
    currentUserId
  );

  function setActiveMember(member: FamilyMember): void {
    familyStore.setActiveMember(member);
  }

  function getRoleLabel(memberRole: MemberRole | string): string {
    return roleLabelByValue.get(memberRole as MemberRole) ?? memberRole;
  }

  function canAuthenticatedAdultSwitchProfiles(
    members: FamilyMember[],
    userId: string | undefined
  ): boolean {
    if (!userId || members.length <= 1) return false;

    return members.some(
      (member) =>
        member.user === userId &&
        (member.role === 'owner' || member.role === 'parent' || member.role === 'adult')
    );
  }

  async function reloadMembers(): Promise<void> {
    if (!context) return;
    const members = await listMembers(context);
    familyStore.setMembers(members);
  }

  async function submitMember(): Promise<void> {
    if (!context) {
      error = 'Сначала подключите семью.';
      return;
    }

    const name = displayName.trim();
    if (!name) {
      error = 'Введите имя профиля.';
      return;
    }

    saving = true;
    error = null;
    success = null;

    try {
      const member = await createMember(
        {
          displayName: name,
          role,
          colorKey
        },
        context
      );
      await reloadMembers();
      familyStore.setActiveMember(member);
      success = `${name} добавлен в семью.`;
      displayName = '';
    } catch (submitError) {
      error = 'Не удалось добавить профиль. Проверьте подключение к серверу.';
      console.warn('Failed to create family member.', submitError);
    } finally {
      saving = false;
    }
  }

  async function linkMember(member: FamilyMember): Promise<void> {
    if (!context || !currentUserId) {
      error = 'Нужен вход в аккаунт и активная семья.';
      return;
    }

    saving = true;
    error = null;
    success = null;

    try {
      const linked = await updateMember(member.id, { user: currentUserId }, context);
      await reloadMembers();
      familyStore.setActiveMember(linked);
      success = `${member.displayName} связан с текущим аккаунтом.`;
    } catch (linkError) {
      error = 'Не удалось связать профиль с аккаунтом.';
      console.warn('Failed to link family member.', linkError);
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((state) => {
      familyState = state;
    });
    sessionUnsubscribe = sessionStore.subscribe((state) => {
      sessionState = state;
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
    sessionUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="family-title-mobile">
  <section class="family-page">
    <header class="top-row">
      <div>
        <p class="section-kicker">Профили</p>
        <h1 id="family-title-mobile">Семья</h1>
      </div>
    </header>

    <ActiveProfileSwitcher
      members={familyState?.members ?? []}
      activeMember={familyState?.activeMember ?? null}
      canSwitch={canSwitchActiveProfile}
      onchange={setActiveMember}
    />

    <section class="family-panel" aria-labelledby="family-members-title-mobile">
      <h2 id="family-members-title-mobile">Члены семьи</h2>
      <div class="family-member-list">
        {#each familyState?.members ?? [] as member (member.id)}
          <article class={`family-member-card family-member-card--${member.colorKey ?? 'green'}`}>
            <span class="family-member-card__avatar">{member.displayName.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{member.displayName}</strong>
              <p>{getRoleLabel(member.role)}{member.user ? ' · связан с аккаунтом' : ''}</p>
            </div>
            <button type="button" disabled={saving || member.user === currentUserId} on:click={() => linkMember(member)}>
              <Link2 size={17} strokeWidth={2.2} aria-hidden="true" />
              {member.user === currentUserId ? 'Ваш' : 'Связать'}
            </button>
          </article>
        {/each}
      </div>
    </section>

    <form class="family-panel family-form" aria-labelledby="family-create-title-mobile" on:submit|preventDefault={submitMember}>
      <h2 id="family-create-title-mobile">Добавить профиль</h2>
      {#if error}<p class="family-message family-message--error">{error}</p>{/if}
      {#if success}<p class="family-message family-message--success">{success}</p>{/if}
      <label>
        <span>Имя</span>
        <input bind:value={displayName} maxlength="60" placeholder="Папа" />
      </label>
      <label>
        <span>Роль</span>
        <select bind:value={role}>
          {#each roleOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Цвет</span>
        <select bind:value={colorKey}>
          {#each colorOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <button class="button button--primary" disabled={saving} type="submit">
        <Plus size={18} strokeWidth={2.3} aria-hidden="true" />
        {saving ? 'Сохраняем' : 'Добавить'}
      </button>
    </form>
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="family-title-desktop">
  <section class="family-page family-page--desktop">
    <header class="desktop-header">
      <div>
        <h1 id="family-title-desktop">Семья</h1>
        <p class="offline-note">Профили, активный семейный контекст и связь с аккаунтом.</p>
      </div>
    </header>
    <ActiveProfileSwitcher
      members={familyState?.members ?? []}
      activeMember={familyState?.activeMember ?? null}
      canSwitch={canSwitchActiveProfile}
      onchange={setActiveMember}
    />
    <section class="family-panel">
      <h2>Члены семьи</h2>
      <div class="family-member-list">
        {#each familyState?.members ?? [] as member (member.id)}
          <article class={`family-member-card family-member-card--${member.colorKey ?? 'green'}`}>
            <span class="family-member-card__avatar">{member.displayName.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{member.displayName}</strong>
              <p>{getRoleLabel(member.role)}{member.user ? ' · связан с аккаунтом' : ''}</p>
            </div>
            <button type="button" disabled={saving || member.user === currentUserId} on:click={() => linkMember(member)}>
              <Link2 size={17} strokeWidth={2.2} aria-hidden="true" />
              {member.user === currentUserId ? 'Ваш' : 'Связать'}
            </button>
          </article>
        {/each}
      </div>
    </section>
  </section>
  <svelte:fragment slot="aside">
    <form class="family-panel family-form" on:submit|preventDefault={submitMember}>
      <h2>Добавить профиль</h2>
      {#if error}<p class="family-message family-message--error">{error}</p>{/if}
      {#if success}<p class="family-message family-message--success">{success}</p>{/if}
      <label>
        <span>Имя</span>
        <input bind:value={displayName} maxlength="60" placeholder="Папа" />
      </label>
      <label>
        <span>Роль</span>
        <select bind:value={role}>
          {#each roleOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Цвет</span>
        <select bind:value={colorKey}>
          {#each colorOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <button class="button button--primary" disabled={saving} type="submit">
        <Plus size={18} strokeWidth={2.3} aria-hidden="true" />
        {saving ? 'Сохраняем' : 'Добавить'}
      </button>
    </form>
  </svelte:fragment>
</DesktopShell>

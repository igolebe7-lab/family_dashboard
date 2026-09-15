<script lang="ts">
  import { getSelectableProfiles } from '$lib/utils/profile-access';
  import Plus from '@lucide/svelte/icons/plus';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Smile from '@lucide/svelte/icons/smile';
  import Copy from '@lucide/svelte/icons/copy';
  import { goto } from '$app/navigation';
  import ColorPicker from '$lib/components/family/ColorPicker.svelte';
  import GlassMemberCard from '$lib/components/family/GlassMemberCard.svelte';
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import ActiveProfileSwitcher from '$lib/components/family/ActiveProfileSwitcher.svelte';
  import { createInvitation } from '$lib/api/invitations.api';
  import { createMember, updateMember, listMembers } from '$lib/api/members.api';
  import { familyStore, type FamilyState } from '$lib/stores/family.store';
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
  const roleLabelByValue = new Map(roleOptions.map((option) => [option.value, option.label]));

  let familyUnsubscribe: Unsubscriber | undefined;
  let sessionUnsubscribe: Unsubscriber | undefined;
  let familyState: FamilyState | undefined;
  let sessionState: SessionState | undefined;
  let displayName = '';
  let editingId: string | null = null;
  let birthday = '';
  let role: MemberRole = 'parent';
  let colorKey = 'blue';
  let managedBy = '';
  let saving = false;
  let error: string | null = null;
  let success: string | null = null;
  let inviteLinks: Record<string, string> = {};

  $: context = accountMember && familyState?.activeFamily
    ? { familyId: familyState.activeFamily.id, memberId: accountMember.id } : null;
  $: currentUserId = sessionState?.user?.id;
  $: accountMember = familyState?.members.find((member) => member.user === currentUserId);
  $: canManage = Boolean(accountMember && ['owner', 'parent'].includes(accountMember.role));
  $: adultMembers = (familyState?.members ?? []).filter((member) =>
    ['owner', 'parent', 'adult'].includes(member.role)
  );
  $: if (role === 'child' && !managedBy) {
    managedBy = familyState?.activeMember?.id ?? adultMembers[0]?.id ?? '';
  }
  $: selectableProfiles = getSelectableProfiles(familyState?.members ?? [], currentUserId);
  $: canSwitchActiveProfile = selectableProfiles.length > 1;

  function setActiveMember(member: FamilyMember): void {
    familyStore.setActiveMember(member);
  }

  function getRoleLabel(memberRole: MemberRole | string): string {
    if (memberRole === 'owner') return 'Владелец семьи';
    return roleLabelByValue.get(memberRole as MemberRole) ?? memberRole;
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

    if (!canManage || saving) return;
    const name = displayName.trim();
    if (!name) {
      error = 'Введите имя профиля.';
      return;
    }

    saving = true;
    error = null;
    success = null;

    try {
      const input = {
        displayName: name, colorKey, birthday,
        managedBy: role === 'child' && managedBy ? [managedBy] : []
      };
      if (editingId) await updateMember(editingId, input, context);
      else await createMember(
        {
          displayName: name,
          role,
          colorKey,
          birthday,
          managedBy: role === 'child' && managedBy ? [managedBy] : []
        },
        context
      );
      await reloadMembers();
      success = editingId ? 'Профиль обновлён.' : `${name} добавлен в семью.`;
      editingId = null;
      displayName = '';
      birthday = '';
      if (role === 'child') managedBy = familyState?.activeMember?.id ?? adultMembers[0]?.id ?? '';
    } catch (submitError) {
      error = 'Не удалось добавить профиль. Проверьте подключение к серверу.';
      console.warn('Failed to create family member.', submitError);
    } finally {
      saving = false;
    }
  }

  async function createInviteForMember(member: FamilyMember): Promise<void> {
    if (!context) {
      error = 'Нужна активная семья.';
      return;
    }

    saving = true;
    error = null;
    success = null;

    try {
      const invitation = await createInvitation(
        {
          memberId: member.id,
          role: (member.role === 'owner' ? 'parent' : member.role) as Exclude<MemberRole, 'owner'>,
          email: undefined
        },
        context
      );
      const origin = typeof window === 'undefined' ? '' : window.location.origin;
      inviteLinks = {
        ...inviteLinks,
        [member.id]: `${origin}/invite/${invitation.code}`
      };
      success = `Ссылка для ${member.displayName} готова.`;
    } catch (inviteError) {
      error = 'Не удалось создать приглашение.';
      console.warn('Failed to create invitation.', inviteError);
    } finally {
      saving = false;
    }
  }

  function canInviteMember(member: FamilyMember): boolean {
    return canManage && !member.user && ['parent', 'adult', 'teen', 'guest'].includes(member.role);
  }

  function editMember(member: FamilyMember): void {
    editingId = member.id;
    displayName = member.displayName;
    role = member.role;
    colorKey = member.colorKey ?? 'green';
    birthday = member.birthday?.slice(0, 10) ?? '';
    managedBy = member.managedBy[0] ?? accountMember?.id ?? '';
    const input = Array.from(document.querySelectorAll<HTMLInputElement>('.family-form input'))
      .find((element) => element.getClientRects().length > 0);
    input?.scrollIntoView({ block: 'center' });
    input?.focus();
  }

  async function openChild(member: FamilyMember): Promise<void> {
    if (!selectableProfiles.some(profile => profile.id === member.id)) return;
    familyStore.setActiveMember(member);
    await goto('/child');
  }

  async function copyInvite(member: FamilyMember): Promise<void> {
    try { await navigator.clipboard.writeText(inviteLinks[member.id]); success = 'Ссылка скопирована.'; }
    catch { error = 'Выделите и скопируйте ссылку вручную.'; }
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
        <h1 id="family-title-mobile">Семья</h1>
      </div>
    </header>

    <ActiveProfileSwitcher
      glass
      members={familyState?.members ?? []}
      activeMember={familyState?.activeMember ?? null}
      canSwitch={canSwitchActiveProfile}
      onchange={setActiveMember}
    />

    <section class="family-panel" aria-labelledby="family-members-title-mobile">
      <h2 id="family-members-title-mobile">Члены семьи</h2>
      <div class="family-member-list">
        {#each familyState?.members ?? [] as member (member.id)}
          <GlassMemberCard {member} roleLabel={getRoleLabel(member.role)}
            own={member.user === currentUserId} editable={canManage}
            invitable={canInviteMember(member)} busy={saving}
            childMode={selectableProfiles.some(profile => profile.id === member.id) && ['child', 'teen'].includes(member.role)}
            inviteLink={inviteLinks[member.id] ?? ''}
            onedit={() => editMember(member)} oninvite={() => createInviteForMember(member)}
            onchild={() => openChild(member)} oncopy={() => copyInvite(member)} />
        {/each}
      </div>
    </section>

    <form class="family-panel family-form" aria-labelledby="family-create-title-mobile" on:submit|preventDefault={submitMember}>
      <h2 id="family-create-title-mobile">{editingId ? 'Изменить профиль' : 'Добавить в семью'}</h2>
      {#if error}<p class="family-message family-message--error">{error}</p>{/if}
      {#if success}<p class="family-message family-message--success">{success}</p>{/if}
      <label>
        <span>Имя</span>
        <input bind:value={displayName} maxlength="60" placeholder="Папа" />
      </label>
      <label>
        <span>Роль</span>
        <select bind:value={role} disabled={Boolean(editingId)}>
          {#if role === 'owner'}<option value="owner">Владелец семьи</option>{/if}
          {#each roleOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <ColorPicker bind:value={colorKey} />
      <label><span>День рождения</span><input type="date" bind:value={birthday} /></label>
      {#if role === 'child'}
        <label>
          <span>Кто управляет профилем</span>
          <select bind:value={managedBy}>
            {#each adultMembers as member}
              <option value={member.id}>{member.displayName}</option>
            {/each}
          </select>
        </label>
      {/if}
      <button class="button button--primary" disabled={saving || !canManage} type="submit">
        <Plus size={18} strokeWidth={2.3} aria-hidden="true" />
        {saving ? 'Сохраняем' : editingId ? 'Сохранить' : 'Добавить'}
      </button>
      {#if editingId}<button class="button button--ghost" type="button" on:click={() => { editingId = null; displayName = ''; role = 'parent'; birthday = ''; }}>Отмена</button>{/if}
    </form>
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="family-title-desktop">
  <section class="family-page family-page--desktop">
    <header class="desktop-header">
      <div>
        <h1 id="family-title-desktop">Семья</h1>
        <p class="offline-note">{familyState?.activeFamily?.name}</p>
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
            {#if member.user === currentUserId}
              <span class="family-member-card__badge">Ваш</span>
            {/if}
            {#if canInviteMember(member)}
              <button type="button" disabled={saving} on:click={() => createInviteForMember(member)}>
                Пригласить
              </button>
            {/if}
            {#if canManage}
              <button type="button" title="Изменить профиль" aria-label={`Изменить профиль ${member.displayName}`} on:click={() => editMember(member)}><Pencil size={17} aria-hidden="true" /></button>
            {/if}
            {#if selectableProfiles.some(profile => profile.id === member.id) && ['child', 'teen'].includes(member.role)}
              <button type="button" on:click={() => openChild(member)}><Smile size={17} aria-hidden="true" />Детский режим</button>
            {/if}
            {#if inviteLinks[member.id]}
              <p class="family-member-card__invite">{inviteLinks[member.id]}</p>
              <button type="button" title="Скопировать ссылку" aria-label="Скопировать ссылку" on:click={() => copyInvite(member)}><Copy size={17} aria-hidden="true" /></button>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  </section>
  <svelte:fragment slot="aside">
    <form class="family-panel family-form" on:submit|preventDefault={submitMember}>
      <h2>{editingId ? 'Изменить профиль' : 'Добавить в семью'}</h2>
      {#if error}<p class="family-message family-message--error">{error}</p>{/if}
      {#if success}<p class="family-message family-message--success">{success}</p>{/if}
      <label>
        <span>Имя</span>
        <input bind:value={displayName} maxlength="60" placeholder="Папа" />
      </label>
      <label>
        <span>Роль</span>
        <select bind:value={role} disabled={Boolean(editingId)}>
          {#if role === 'owner'}<option value="owner">Владелец семьи</option>{/if}
          {#each roleOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <ColorPicker bind:value={colorKey} />
      <label><span>День рождения</span><input type="date" bind:value={birthday} /></label>
      {#if role === 'child'}
        <label>
          <span>Кто управляет профилем</span>
          <select bind:value={managedBy}>
            {#each adultMembers as member}
              <option value={member.id}>{member.displayName}</option>
            {/each}
          </select>
        </label>
      {/if}
      <button class="button button--primary" disabled={saving || !canManage} type="submit">
        <Plus size={18} strokeWidth={2.3} aria-hidden="true" />
        {saving ? 'Сохраняем' : editingId ? 'Сохранить' : 'Добавить'}
      </button>
      {#if editingId}<button class="button button--ghost" type="button" disabled={saving} on:click={() => { editingId = null; displayName = ''; role = 'parent'; birthday = ''; }}>Отмена</button>{/if}
    </form>
  </svelte:fragment>
</DesktopShell>

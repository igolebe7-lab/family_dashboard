<script lang="ts">
  import type { FamilyMember } from '$lib/types/domain';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { sessionStore } from '$lib/stores/session.store';
  import { getSelectableProfiles } from '$lib/utils/profile-access';
  import ProfileAvatar from '$lib/components/media/ProfileAvatar.svelte';

  export let members: FamilyMember[] = [];
  export let activeMember: FamilyMember | null = null;
  export let canSwitch: boolean | undefined = undefined;
  export let glass = false;
  export let onchange: ((member: FamilyMember) => void) | undefined = undefined;

  $: selectable = getSelectableProfiles(members, $sessionStore.user?.id);
  $: canSwitchProfiles = selectable.length > 1 && canSwitch !== false;

  function changeActiveMember(memberId: string): void {
    const member = selectable.find((item) => item.id === memberId);
    if (member) onchange?.(member);
  }
</script>

{#if canSwitchProfiles}
  <label class:family-glass-switcher={glass} class="active-profile-switcher">
    <span>Активный профиль</span>
    {#if glass}
      <span class="family-glass-select">
        <span class="family-glass-select__avatar" style="background: transparent; box-shadow: none" aria-hidden="true">{#if activeMember}<ProfileAvatar member={activeMember} size={34} />{/if}</span>
        <select value={activeMember?.id} on:change={(event) => changeActiveMember(event.currentTarget.value)}>
          {#each selectable as member (member.id)}<option value={member.id}>{member.displayName}</option>{/each}
        </select>
        <ChevronDown size={18} aria-hidden="true" />
      </span>
    {:else}
    <select value={activeMember?.id} on:change={(event) => changeActiveMember(event.currentTarget.value)}>
      {#each selectable as member (member.id)}
        <option value={member.id}>{member.displayName}</option>
      {/each}
    </select>
    {/if}
  </label>
{/if}

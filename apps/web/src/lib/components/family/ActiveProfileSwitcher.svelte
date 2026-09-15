<script lang="ts">
  import type { FamilyMember } from '$lib/types/domain';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { sessionStore } from '$lib/stores/session.store';
  import { getSelectableProfiles } from '$lib/utils/profile-access';

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
        <span class="family-glass-select__avatar" style={`--member-tone: var(--color-${activeMember?.colorKey ?? 'blue'})`} aria-hidden="true">{activeMember?.displayName.charAt(0).toUpperCase()}</span>
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

<script lang="ts">
  import type { FamilyMember } from '$lib/types/domain';

  export let members: FamilyMember[] = [];
  export let activeMember: FamilyMember | null = null;
  export let canSwitch: boolean | undefined = undefined;
  export let onchange: ((member: FamilyMember) => void) | undefined = undefined;

  const adultRoles = new Set(['owner', 'parent', 'adult']);

  $: canSwitchProfiles =
    members.length > 1 &&
    (canSwitch ?? Boolean(activeMember && adultRoles.has(activeMember.role)));

  function changeActiveMember(memberId: string): void {
    const member = members.find((item) => item.id === memberId);
    if (member) onchange?.(member);
  }
</script>

{#if canSwitchProfiles}
  <label class="active-profile-switcher">
    <span>Активный профиль</span>
    <select value={activeMember?.id} on:change={(event) => changeActiveMember(event.currentTarget.value)}>
      {#each members as member (member.id)}
        <option value={member.id}>{member.displayName}</option>
      {/each}
    </select>
  </label>
{/if}

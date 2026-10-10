<script lang="ts">
  import type { FamilyMember } from '$lib/types/domain';
  import { COLLECTIONS } from '$lib/constants/collections';
  import ProtectedImage from './ProtectedImage.svelte';

  export let member: FamilyMember;
  export let size = 48;
  export let className = '';

  $: diameter = Number.isFinite(size) ? Math.max(16, size) : 48;
  $: tone = member.colorHex || `var(--color-${member.colorKey || 'blue'}, var(--color-blue))`;
  $: initial = member.displayName.trim().charAt(0).toUpperCase() || '?';
</script>

<span class={`profile-avatar ${className}`} style={`--avatar-size: ${diameter}px; --avatar-inset: ${Math.max(2, diameter * 0.08)}px; --avatar-tone: ${tone}; --avatar-font: ${Math.max(10, diameter * 0.38)}px`} aria-hidden="true">
  <span class="profile-avatar__circle">
    {#if member.avatar}
      <ProtectedImage collection={COLLECTIONS.familyMembers} id={member.id} filename={member.avatar} thumb={diameter <= 64 ? '128x128' : '512x512'}>
        <span class="profile-avatar__initial">{initial}</span>
      </ProtectedImage>
    {:else}
      <span class="profile-avatar__initial">{initial}</span>
    {/if}
  </span>
</span>

<style>
  .profile-avatar { box-sizing: border-box; display: grid; place-items: center; align-self: center; justify-self: center; flex: 0 0 auto; width: var(--avatar-size); max-width: 100%; aspect-ratio: 1; padding: var(--avatar-inset); border-radius: 50%; color: var(--avatar-tone); background: color-mix(in srgb, var(--avatar-tone) 20%, var(--color-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--avatar-tone) 35%, transparent); }
  .profile-avatar__circle { display: grid; place-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; border-radius: 50%; overflow: hidden; background: color-mix(in srgb, var(--avatar-tone) 12%, var(--color-surface)); }
  .profile-avatar__initial { display: grid; place-items: center; width: 100%; height: 100%; font-size: var(--avatar-font); line-height: 1; font-weight: 600; }
</style>

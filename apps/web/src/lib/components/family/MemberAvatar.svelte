<script lang="ts">
  import type { AccentColor } from '$lib/constants/colors';
  import type { FamilyMember } from '$lib/types/domain';
  import ProfileAvatar from '$lib/components/media/ProfileAvatar.svelte';

  export let name: string;
  export let color: AccentColor;
  export let roleLabel = '';
  export let todayCount: number | undefined = undefined;
  export let selected = false;
  export let member: FamilyMember | undefined = undefined;
  $: profile = member ?? { id: '', family: '', displayName: name, role: 'guest' as const, colorKey: color, managedBy: [], active: true };
</script>

<a
  class:member-avatar-card--selected={selected}
  class={`member-avatar-card member-avatar-card--${color}`}
  href="/app/family"
  title={name}
  aria-label={`${name}${roleLabel ? `, ${roleLabel}` : ''}${todayCount ? `, дел сегодня: ${todayCount}` : ''}`}
>
  <ProfileAvatar member={profile} size={72} />
  <span class="member-avatar-card__label">
    <span class="member-avatar-card__dot" aria-hidden="true"></span>
    <span class="member-avatar-card__name">{name}</span>
  </span>
</a>

<style>
  .member-avatar-card__name {
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
    overflow: hidden; max-height: 2.8em;
  }
</style>

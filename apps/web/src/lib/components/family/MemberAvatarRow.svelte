<script lang="ts">
  import type { TodayFamilyMember } from '$lib/today/today-view-model';
  import MemberAvatar from './MemberAvatar.svelte';

  export let members: TodayFamilyMember[] = [];
</script>

<section class="member-avatar-row" aria-label="Члены семьи">
  {#each members as member, index (member.id)}
    <MemberAvatar
      name={member.name}
      initial={member.initial}
      color={member.color}
      roleLabel={member.roleLabel}
      todayCount={member.todayCount}
      selected={index === 0}
    />
  {/each}
</section>

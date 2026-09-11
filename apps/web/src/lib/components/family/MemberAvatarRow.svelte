<script lang="ts">
  import type { TodayFamilyMember } from '$lib/today/today-view-model';
  import MemberAvatar from './MemberAvatar.svelte';

  export let members: TodayFamilyMember[] = [];
</script>

<section class="member-avatar-row" aria-label="Члены семьи">
  {#each members as member (member.id)}
    <MemberAvatar
      name={member.name}
      initial={member.initial}
      color={member.color}
      portrait={member.portrait}
      roleLabel={member.roleLabel}
      todayCount={member.todayCount}
    />
  {/each}
</section>

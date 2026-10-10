<script lang="ts">
  import type { TodayFamilyMember } from '$lib/today/today-view-model';
  import MemberAvatar from './MemberAvatar.svelte';

  export let members: TodayFamilyMember[] = [];
</script>

<section class="member-avatar-row" aria-label="Члены семьи">
  {#each members as member (member.id)}
    <MemberAvatar
      member={member.profile}
      name={member.name}
      color={member.color}
      roleLabel={member.roleLabel}
      todayCount={member.todayCount}
    />
  {/each}
</section>

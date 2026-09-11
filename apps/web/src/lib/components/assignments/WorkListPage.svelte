<script lang="ts">
  import { onMount } from 'svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import ComposerSheet from '$lib/components/composer/ComposerSheet.svelte';
  import { familyStore } from '$lib/stores/family.store';
  import { createWorkList } from '$lib/assignments/work-list';
  import { createAssignmentViewModels, createTaskViewModels, type WorkStatusGroup, type AssignmentAction, type AssignmentCardModel } from '$lib/assignments/assignments-view';
  import WorkListContent from './WorkListContent.svelte';

  export let kind: 'assignment' | 'task';
  const list = createWorkList(kind);
  let status: WorkStatusGroup | 'all' = 'open';
  let memberId = '';
  let query = '';
  let composerOpen = false;
  let identity = '';
  $: activeRoute = kind === 'task' ? '/app/tasks' : '/app/assignments';
  $: nextIdentity = `${$list.context?.familyId ?? ''}:${$list.context?.memberId ?? ''}`;
  $: if (identity !== nextIdentity) { identity = nextIdentity; composerOpen = false; memberId = ''; query = ''; status = 'open'; }
  $: input = { occurrences: $list.occurrences, items: $list.items, members: $list.family?.members ?? [], activeMemberId: $list.context?.memberId, timezone: $list.family?.activeFamily?.timezone };
  $: cards = kind === 'task' ? createTaskViewModels(input) : createAssignmentViewModels(input);
  function runAction(action: AssignmentAction, card: AssignmentCardModel, reason?: string) { return list.act(action, card.id, reason); }
  onMount(() => {
    const unsubscribe = familyStore.subscribe((family) => { void list.setFamily(family); });
    return () => { unsubscribe(); list.destroy(); };
  });
</script>

<MobileShell {activeRoute} labelledBy={`${kind}-title-mobile`}>
  <WorkListContent titleId={`${kind}-title-mobile`} {kind} {cards} state={$list} bind:status bind:memberId bind:query oncreate={() => composerOpen = true} onreload={list.reload} onaction={runAction} />
</MobileShell>
<DesktopShell {activeRoute} labelledBy={`${kind}-title-desktop`}>
  <WorkListContent titleId={`${kind}-title-desktop`} {kind} {cards} state={$list} bind:status bind:memberId bind:query oncreate={() => composerOpen = true} onreload={list.reload} onaction={runAction} />
</DesktopShell>
{#if composerOpen && $list.context}
  <ComposerSheet activeKind="task" context={$list.context} members={input.members.filter((member) => member.active && member.family === $list.context?.familyId)} timezone={$list.family?.activeFamily?.timezone} onclose={() => composerOpen = false} oncreated={list.reload} />
{/if}

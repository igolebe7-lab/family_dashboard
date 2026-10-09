<script lang="ts">
  import { onMount } from 'svelte';
  import { displayTimezone } from '$lib/stores/timezone.store';
  import type { ItemPriority } from '$lib/types/domain';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import ComposerSheet from '$lib/components/composer/ComposerSheet.svelte';
  import { familyStore, getActiveFamilyContext } from '$lib/stores/family.store';
  import { createRealtimeStore } from '$lib/stores/realtime.store';
  import { itemDetailsStore } from '$lib/stores/item-details.store';
  import { desktopViewport } from '$lib/stores/viewport.store';
  import { createWorkList } from '$lib/assignments/work-list';
  import { createWorkViewModels, type WorkStatusGroup, type AssignmentAction, type AssignmentCardModel } from '$lib/assignments/assignments-view';
  import WorkListContent from './WorkListContent.svelte';

  const kind = 'work';
  const list = createWorkList('work');
  let status: WorkStatusGroup | 'all' = 'open';
  let memberId = '';
  let query = '';
  let priority: ItemPriority | 'all' = 'all';
  let composerOpen = false;
  let identity = '';
  const activeRoute = '/app/tasks';
  $: nextIdentity = `${$list.context?.familyId ?? ''}:${$list.context?.memberId ?? ''}`;
  $: if (identity !== nextIdentity) { identity = nextIdentity; composerOpen = false; memberId = ''; query = ''; status = 'open'; priority = 'all'; }
  $: input = { occurrences: $list.occurrences, items: $list.items, members: $list.family?.members ?? [], activeMemberId: $list.context?.memberId, timezone: $displayTimezone };
  $: cards = createWorkViewModels(input);
  function runAction(action: AssignmentAction, card: AssignmentCardModel, reason?: string) { return list.act(action, card.id, reason); }
  onMount(() => {
    const realtime = createRealtimeStore();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const refresh = () => { if (alive && timer === undefined) timer = setTimeout(() => { timer = undefined; void list.reload(); }, 120); };
    const unsubscribe = familyStore.subscribe((family) => {
      void list.setFamily(family);
      const context = getActiveFamilyContext(family);
      if (!context) { realtime.stopAll(); return; }
      void Promise.all([
        realtime.syncActivity(context, refresh),
        realtime.syncFamilyChanges(context, () => { list.invalidate(); itemDetailsStore.set(null); refresh(); }),
        realtime.syncRecovery(context, refresh)
      ]).catch(error => console.warn('Work realtime unavailable.', error));
    });
    const foreground = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', foreground);
    return () => { alive = false; clearTimeout(timer); unsubscribe(); realtime.stopAll(); document.removeEventListener('visibilitychange', foreground); list.destroy(); };
  });
</script>

<svelte:window on:online={list.reload} />

{#if !$desktopViewport}
<MobileShell {activeRoute} labelledBy={`${kind}-title-mobile`}>
  <WorkListContent titleId={`${kind}-title-mobile`} {kind} {cards} state={$list} bind:status bind:memberId bind:query bind:priority oncreate={() => composerOpen = true} onreload={list.reload} onaction={runAction} />
</MobileShell>
{:else}
<DesktopShell {activeRoute} labelledBy={`${kind}-title-desktop`}>
  <WorkListContent titleId={`${kind}-title-desktop`} {kind} {cards} state={$list} bind:status bind:memberId bind:query bind:priority oncreate={() => composerOpen = true} onreload={list.reload} onaction={runAction} />
</DesktopShell>
{/if}
{#if composerOpen && $list.context}
  <ComposerSheet activeKind="task" context={$list.context} members={input.members.filter((member) => member.active && member.family === $list.context?.familyId)} timezone={$displayTimezone} onclose={() => composerOpen = false} oncreated={list.reload} />
{/if}

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import AssignmentCard from '$lib/components/assignments/AssignmentCard.svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import {
    approveOccurrence,
    listOccurrencesInRange,
    markOccurrenceDone,
    rejectOccurrence
  } from '$lib/api/occurrences.api';
  import {
    createAssignmentViewModels,
    type AssignmentAction,
    type AssignmentCardModel
  } from '$lib/assignments/assignments-view';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';
  import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';

  const activeRoute = '/app/assignments';
  let familyUnsubscribe: Unsubscriber | undefined;
  let currentFamilyState: FamilyState | undefined;
  let cards: AssignmentCardModel[] = createAssignmentViewModels({
    occurrences: demoOccurrences,
    members: demoMembers,
    activeMemberId: 'parent'
  });
  let busyOccurrenceId: string | null = null;
  let message: string | null = null;
  let error: string | null = null;

  async function loadAssignments(familyState: FamilyState | undefined): Promise<void> {
    const context = familyState ? getActiveFamilyContext(familyState) : null;
    if (!context || familyState?.status !== 'ready') return;

    try {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      const to = new Date(now);
      to.setDate(to.getDate() + 90);
      const result = await listOccurrencesInRange(context, {
        from: from.toISOString(),
        to: to.toISOString()
      });
      cards = createAssignmentViewModels({
        occurrences: result.items,
        members: familyState.members,
        activeMemberId: familyState.activeMember?.id
      });
    } catch (loadError) {
      console.warn('Failed to load assignments.', loadError);
      error = 'Не удалось загрузить поручения. Показываем сохранённый пример.';
    }
  }

  async function runAction(action: AssignmentAction, card: AssignmentCardModel): Promise<void> {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context) return;

    busyOccurrenceId = card.id;
    error = null;
    message = null;

    try {
      if (action === 'mark_assignment_done') await markOccurrenceDone(card.id, context);
      if (action === 'approve_assignment') await approveOccurrence(card.id, context);
      if (action === 'reject_assignment') await rejectOccurrence(card.id, context, 'Нужно чуть поправить');
      message =
        action === 'approve_assignment'
          ? 'Поручение подтверждено.'
          : action === 'reject_assignment'
            ? 'Поручение возвращено мягко.'
            : 'Отметили как готово.';
      await loadAssignments(currentFamilyState);
    } catch (actionError) {
      console.warn('Failed to update assignment.', actionError);
      error = 'Не удалось обновить поручение.';
    } finally {
      busyOccurrenceId = null;
    }
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((familyState) => {
      currentFamilyState = familyState;
      void loadAssignments(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });
</script>

<MobileShell {activeRoute} labelledBy="assignments-title-mobile">
  <section class="assignments-page">
    <header class="top-row">
      <div>
        <p class="section-kicker">Дом</p>
        <h1 id="assignments-title-mobile">Поручения</h1>
      </div>
    </header>

    {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}
    {#if message}<p class="today-action-message">{message}</p>{/if}

    <div class="assignments-list">
      {#if cards.length > 0}
        {#each cards as card (card.id)}
          <AssignmentCard {card} busy={busyOccurrenceId === card.id} onaction={runAction} />
        {/each}
      {:else}
        <p class="page-empty-state">Поручений пока нет. Когда появятся домашние дела, они будут здесь.</p>
      {/if}
    </div>
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="assignments-title-desktop">
  <section class="assignments-page assignments-page--desktop">
    <header class="desktop-header">
      <div>
        <h1 id="assignments-title-desktop">Поручения</h1>
        <p class="offline-note">Выполнение, проверка и мягкий возврат домашних поручений.</p>
      </div>
    </header>

    {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}
    {#if message}<p class="today-action-message">{message}</p>{/if}

    <div class="assignments-list assignments-list--desktop">
      {#if cards.length > 0}
        {#each cards as card (card.id)}
          <AssignmentCard {card} busy={busyOccurrenceId === card.id} onaction={runAction} />
        {/each}
      {:else}
        <p class="page-empty-state">Поручений пока нет. Когда появятся домашние дела, они будут здесь.</p>
      {/if}
    </div>
  </section>
</DesktopShell>

<script lang="ts" context="module">
  const demoMembers: FamilyMember[] = [
    {
      id: 'parent',
      family: 'demo',
      displayName: 'Мама',
      role: 'parent',
      colorKey: 'lavender',
      managedBy: [],
      active: true
    },
    {
      id: 'child',
      family: 'demo',
      displayName: 'Миша',
      role: 'child',
      colorKey: 'green',
      managedBy: ['parent'],
      active: true
    }
  ];

  const demoOccurrences: ItemOccurrence[] = [
    {
      id: 'demo_done',
      family: 'demo',
      item: 'item_done',
      visibleTo: ['parent', 'child'],
      kind: 'assignment',
      titleSnapshot: 'Вынести мусор',
      categorySnapshot: 'home',
      dueAt: new Date().toISOString(),
      allDay: false,
      status: 'done',
      completedBy: 'child'
    },
    {
      id: 'demo_open',
      family: 'demo',
      item: 'item_open',
      visibleTo: ['parent', 'child'],
      kind: 'assignment',
      titleSnapshot: 'Собрать рюкзак',
      categorySnapshot: 'school',
      dueAt: new Date().toISOString(),
      allDay: false,
      status: 'assigned'
    }
  ];
</script>

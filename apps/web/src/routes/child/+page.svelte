<script lang="ts" context="module">
  import type { FamilyMember, ItemOccurrence } from '$lib/types/domain';

  const demoMembers: FamilyMember[] = [
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
      id: 'demo_assignment',
      family: 'demo',
      item: 'demo_assignment_item',
      visibleTo: ['child'],
      kind: 'assignment',
      titleSnapshot: 'Собрать рюкзак',
      categorySnapshot: 'school',
      dueAt: new Date().toISOString(),
      allDay: false,
      status: 'assigned'
    },
    {
      id: 'demo_school',
      family: 'demo',
      item: 'demo_school_item',
      visibleTo: ['child'],
      kind: 'event',
      titleSnapshot: 'Школа',
      categorySnapshot: 'school',
      startAt: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
      endAt: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
      allDay: false,
      status: 'todo'
    }
  ];
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';
  import AssignmentCard from '$lib/components/assignments/AssignmentCard.svelte';
  import { listOccurrencesInRange, markOccurrenceDone } from '$lib/api/occurrences.api';
  import {
    createChildModeViewModel,
    type AssignmentAction,
    type AssignmentCardModel,
    type ChildModeViewModel
  } from '$lib/assignments/assignments-view';
  import { familyStore, getActiveFamilyContext, type FamilyState } from '$lib/stores/family.store';

  let familyUnsubscribe: Unsubscriber | undefined;
  let currentFamilyState: FamilyState | undefined;
  let model: ChildModeViewModel = createChildModeViewModel({
    occurrences: demoOccurrences,
    members: demoMembers,
    activeMemberId: 'child'
  });
  let busyOccurrenceId: string | null = null;
  let message: string | null = null;
  let error: string | null = null;

  async function loadChildMode(familyState: FamilyState | undefined): Promise<void> {
    const context = familyState ? getActiveFamilyContext(familyState) : null;
    if (!context || familyState?.status !== 'ready') return;

    const childMember =
      familyState.activeMember?.role === 'child'
        ? familyState.activeMember
        : familyState.members.find((member) => member.role === 'child');
    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setDate(to.getDate() + 7);

    try {
      const result = await listOccurrencesInRange(context, {
        from: from.toISOString(),
        to: to.toISOString()
      });
      model = createChildModeViewModel({
        occurrences: result.items,
        members: familyState.members,
        activeMemberId: childMember?.id,
        date: now
      });
      error = null;
    } catch (loadError) {
      console.warn('Failed to load child mode.', loadError);
      error = 'Не удалось загрузить детский режим. Показываем сохранённый пример.';
    }
  }

  async function runAction(action: AssignmentAction, card: AssignmentCardModel): Promise<void> {
    const context = currentFamilyState ? getActiveFamilyContext(currentFamilyState) : null;
    if (!context || action !== 'mark_assignment_done') return;

    busyOccurrenceId = card.id;
    message = null;
    error = null;
    try {
      await markOccurrenceDone(card.id, context);
      message = 'Готово, взрослые проверят.';
      await loadChildMode(currentFamilyState);
    } catch (actionError) {
      console.warn('Failed to update child assignment.', actionError);
      error = 'Не удалось отметить поручение.';
    } finally {
      busyOccurrenceId = null;
    }
  }

  onMount(() => {
    familyUnsubscribe = familyStore.subscribe((familyState) => {
      currentFamilyState = familyState;
      void loadChildMode(familyState);
    });
  });

  onDestroy(() => {
    familyUnsubscribe?.();
  });
</script>

<main class="child-mode" aria-labelledby="child-title">
  <section class="child-mode__hero">
    <p class="section-kicker">Детский режим</p>
    <h1 id="child-title">{model.greeting}</h1>
    <p>Твои дела сегодня</p>
  </section>

  {#if message}<p class="today-action-message">{message}</p>{/if}
  {#if error}<p class="today-action-message today-action-message--error">{error}</p>{/if}

  <section class="child-mode__section" aria-labelledby="child-assignments-title">
    <h2 id="child-assignments-title">Что нужно сделать</h2>
    <div class="assignments-list">
      {#if model.assignmentCards.length > 0}
        {#each model.assignmentCards as card (card.id)}
          <AssignmentCard {card} busy={busyOccurrenceId === card.id} onaction={runAction} />
        {/each}
      {:else}
        <p class="page-empty-state">На сегодня поручений нет.</p>
      {/if}
    </div>
  </section>

  <section class="child-mode__section" aria-labelledby="child-schedule-title">
    <h2 id="child-schedule-title">Твоё расписание</h2>
    <div class="child-schedule">
      {#if model.scheduleItems.length > 0}
        {#each model.scheduleItems as item (item.id)}
          <article>
            <time>{item.time}</time>
            <strong>{item.title}</strong>
          </article>
        {/each}
      {:else}
        <p class="page-empty-state">Расписание свободное.</p>
      {/if}
    </div>
  </section>
</main>

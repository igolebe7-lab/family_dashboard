<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { onDestroy, onMount } from 'svelte';
  import { createItem } from '$lib/api/items.api';
  import type { ActiveFamilyContext } from '$lib/api/pocketbase';
  import {
    createComposerFormValues,
    createComposerItemInput,
    setComposerKind,
    type ComposerFormValues,
    type ComposerKind
  } from '$lib/composer/composer-form';
  import type { FamilyMember } from '$lib/types/domain';
  import ComposerTabs from './ComposerTabs.svelte';
  import EventForm from './EventForm.svelte';
  import TaskForm from './TaskForm.svelte';

  export let activeKind: ComposerKind = 'event';
  export let context: ActiveFamilyContext | null = null;
  export let members: FamilyMember[] = [];
  export let selectedDate: Date = new Date();
  export let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  export let titleId = 'composer-title';
  export let onclose: (() => void) | undefined = undefined;
  export let oncreated: (() => void | Promise<void>) | undefined = undefined;

  let values: ComposerFormValues = createComposerFormValues({
    activeMemberId: context?.memberId,
    date: selectedDate,
    kind: activeKind
  });
  let validationErrors: string[] = [];
  let submitError: string | null = null;
  let successMessage: string | null = null;
  let saving = false;
  let previousBodyOverflow = '';
  let previousBodyOverscrollBehavior = '';
  let draftReady = false;

  const draftKey = 'familytime:composer:draft';

  onMount(() => {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const rawDraft = sessionStorage.getItem(draftKey);
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft) as ComposerFormValues;
        values = {
          ...values,
          ...draft,
          activeMemberId: context?.memberId ?? draft.activeMemberId,
          familyMemberIds: draft.familyMemberIds ?? values.familyMemberIds
        };
        activeKind = values.kind;
      } catch (error) {
        console.warn('Failed to restore composer draft.', error);
      }
    }
    draftReady = true;
  });

  onDestroy(() => {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
  });

  $: if (values.kind !== activeKind) {
    values = setComposerKind(values, activeKind);
  }
  $: if (draftReady) {
    sessionStorage.setItem(draftKey, JSON.stringify(values));
  }
  $: {
    const familyMemberIds = members.map((member) => member.id).filter(Boolean);
    const nextIds = Array.from(
      new Set([...familyMemberIds, context?.memberId].filter((memberId): memberId is string => Boolean(memberId)))
    );
    if (nextIds.join('|') !== values.familyMemberIds.join('|') || (context?.memberId && values.activeMemberId !== context.memberId)) {
      values = {
        ...values,
        activeMemberId: context?.memberId ?? values.activeMemberId,
        familyMemberIds: nextIds,
        owner: values.owner || context?.memberId || '',
        participants: values.participants.length > 0 ? values.participants : context?.memberId ? [context.memberId] : []
      };
    }
  }

  function changeKind(kind: ComposerKind): void {
    activeKind = kind;
    validationErrors = [];
    submitError = null;
    successMessage = null;
  }

  function closeComposer(clearDraft = true): void {
    if (clearDraft) sessionStorage.removeItem(draftKey);
    onclose?.();
  }

  async function submitForm(): Promise<void> {
    submitError = null;
    successMessage = null;

    const result = createComposerItemInput(values, timezone);
    if (!result.ok) {
      validationErrors = result.errors;
      return;
    }

    if (!context) {
      submitError = 'Сначала подключите семью, затем можно будет создавать записи.';
      return;
    }

    validationErrors = [];
    saving = true;

    try {
      await createItem(result.input, context);
      successMessage = getSuccessMessage(values.kind);
      await oncreated?.();
      sessionStorage.removeItem(draftKey);
      values = createComposerFormValues({
        activeMemberId: context.memberId,
        date: selectedDate,
        kind: values.kind
      });
      onclose?.();
    } catch (error) {
      submitError = 'Не удалось сохранить. Проверьте поля или подключение к серверу.';
      console.warn('Failed to create item from composer.', error);
    } finally {
      saving = false;
    }
  }

  function getSuccessMessage(kind: ComposerKind): string {
    if (kind === 'task') return 'Задача создана';
    return 'Событие создано';
  }
</script>

<div class="composer-backdrop" role="presentation" on:click={() => closeComposer()}></div>
<div class="composer-sheet" aria-labelledby={titleId} role="dialog" aria-modal="true">
  <header class="composer-sheet__header">
    <div>
      <p class="section-kicker">Создание</p>
      <h2 id={titleId}>Новая запись</h2>
    </div>
    <button type="button" aria-label="Закрыть форму" on:click={() => closeComposer()}>
      <X size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </header>

  <ComposerTabs value={values.kind} onchange={changeKind} />

  {#if validationErrors.length > 0}
    <div class="composer-message composer-message--error" role="alert">
      {#each validationErrors as validationError}
        <p>{validationError}</p>
      {/each}
    </div>
  {/if}

  {#if submitError}
    <p class="composer-message composer-message--error" role="alert">{submitError}</p>
  {/if}

  {#if successMessage}
    <p class="composer-message composer-message--success" role="status">{successMessage}</p>
  {/if}

  <form class="composer-form" on:submit|preventDefault={submitForm}>
    {#if values.kind === 'event'}
      <EventForm bind:values {members} />
    {:else}
      <TaskForm bind:values {members} />
    {/if}

    <div class="composer-sheet__actions">
      <button class="button button--ghost" disabled={saving} type="button" on:click={() => closeComposer()}>
        Отмена
      </button>
      <button class="button button--primary" disabled={saving} type="submit">
        {saving ? 'Сохраняем' : 'Создать'}
      </button>
    </div>
  </form>
</div>

<script lang="ts">
  import SheetHandle from '$lib/components/ui/SheetHandle.svelte';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy, onMount } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { createItem } from '$lib/api/items.api';
  import { composerDraftKey, createComposerDraftStorage } from '$lib/composer/composer-draft';
  import { openComposerDialog } from '$lib/composer/modal-focus';
  import type { ActiveFamilyContext } from '$lib/api/pocketbase';
  import {
    createComposerFormValues,
    createComposerItemInput,
    FAMILY_TARGET,
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
  let draftReady = false;
  let dialog: HTMLDialogElement;
  let draftContext: ActiveFamilyContext | null = null;
  let loadedScope: string | null = null;
  let scopeVersion = 0;
  let storageWarning: string | null = null;
  const drafts = createComposerDraftStorage();

  beforeNavigate((navigation) => {
    if (saving) navigation.cancel();
  });

  onMount(() => {
    // Today renders both responsive shells; only the visible instance owns the modal and draft.
    let ancestor = dialog.parentElement;
    while (ancestor) {
      if (getComputedStyle(ancestor).display === 'none') return;
      ancestor = ancestor.parentElement;
    }
    restoreScope(context);
    draftReady = true;
    return openComposerDialog(dialog, closeComposer);
  });

  onDestroy(() => {
    if (draftReady && draftContext) drafts.save(draftContext, values);
  });

  $: currentScope = context ? composerDraftKey(context) : null;
  $: if (draftReady && currentScope !== loadedScope) restoreScope(context);

  $: if (values.kind !== activeKind) {
    values = setComposerKind(values, activeKind);
  }
  $: if (draftReady && draftContext && currentScope === loadedScope) {
    persistDraft(values);
  }
  $: {
    const familyMemberIds = members.filter(member => member.active && member.family === context?.familyId).map((member) => member.id).filter(Boolean);
    const nextIds = Array.from(
      new Set([...familyMemberIds, context?.memberId].filter((memberId): memberId is string => Boolean(memberId)))
    );
    if (nextIds.join('|') !== values.familyMemberIds.join('|') || (context?.memberId && values.activeMemberId !== context.memberId)) {
      values = {
        ...values,
        activeMemberId: context?.memberId ?? values.activeMemberId,
        familyMemberIds: nextIds,
        owner: values.owner === FAMILY_TARGET || nextIds.includes(values.owner) ? values.owner : context?.memberId || '',
        assignee: nextIds.includes(values.assignee) ? values.assignee : '',
        participants: values.participants.filter(id => id === FAMILY_TARGET || nextIds.includes(id))
      };
    }
  }

  function changeKind(kind: ComposerKind): void {
    if (saving) return;
    activeKind = kind;
    validationErrors = [];
    submitError = null;
    successMessage = null;
  }

  function persistDraft(draft: ComposerFormValues): void {
    if (!draftContext) return;
    storageWarning = drafts.save(draftContext, draft) ? null : 'Не удалось сохранить черновик в браузере. Не закрывайте страницу до создания записи.';
  }

  function restoreScope(nextContext: ActiveFamilyContext | null): void {
    if (draftReady && draftContext) drafts.save(draftContext, values);
    scopeVersion += 1;
    draftContext = nextContext ? { ...nextContext } : null;
    loadedScope = draftContext ? composerDraftKey(draftContext) : null;
    const defaults = createComposerFormValues({ activeMemberId: nextContext?.memberId, date: selectedDate, kind: activeKind });
    values = draftContext ? drafts.restore(draftContext, defaults) ?? defaults : defaults;
    activeKind = values.kind;
    validationErrors = [];
    submitError = null;
    successMessage = null;
    storageWarning = null;
  }

  function closeComposer(): void {
    if (saving) return;
    if (draftReady && draftContext) persistDraft(values);
    onclose?.();
  }

  function discardDraft(): void {
    if (saving) return;
    if (draftContext && !drafts.remove(draftContext)) {
      storageWarning = 'Не удалось удалить черновик из браузера. Попробуйте ещё раз.';
      return;
    }
    draftReady = false;
    onclose?.();
  }

  function backdropClick(event: MouseEvent): void {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeComposer();
  }

  async function submitForm(): Promise<void> {
    if (saving) return;
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
    const submittedContext = { ...context };
    const submittedScope = scopeVersion;
    const submittedKind = values.kind;

    try {
      await createItem(result.input, submittedContext);
    } catch (error) {
      if (submittedScope === scopeVersion) submitError = 'Не удалось сохранить. Проверьте поля или подключение к серверу.';
      console.warn('Failed to create item from composer.', error);
      saving = false;
      return;
    }

    // A failed refresh must not turn a successful create into a retryable create error.
    drafts.remove(submittedContext);
    if (submittedScope !== scopeVersion) { saving = false; return; }
    draftReady = false;
    successMessage = getSuccessMessage(submittedKind);
    try { await oncreated?.(); } catch (error) { console.warn('Created item, but refresh failed.', error); }
    saving = false;
    if (submittedScope === scopeVersion) onclose?.();
  }

  function getSuccessMessage(kind: ComposerKind): string {
    if (kind === 'task') return 'Задача создана';
    return 'Событие создано';
  }
</script>

<dialog bind:this={dialog} class="composer-sheet" aria-labelledby={titleId} aria-modal="true" aria-busy={saving} on:click={backdropClick}>
  <SheetHandle onclose={closeComposer} disabled={saving} />
  <header class="composer-sheet__header">
    <div>
      <p class="section-kicker">Создание</p>
      <h2 id={titleId}>Новая запись</h2>
    </div>
    <button class="sheet-desktop-close" type="button" disabled={saving} aria-label="Закрыть форму" on:click={() => closeComposer()}>
      <X size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </header>

  <div class="composer-sheet__content">
  <fieldset class="composer-kind-controls" disabled={saving} aria-label="Тип записи">
    <ComposerTabs value={values.kind} onchange={changeKind} />
  </fieldset>

  {#if storageWarning}<p class="composer-message composer-message--error" role="status">{storageWarning}</p>{/if}

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
    <fieldset class="composer-fields" disabled={saving} aria-label="Поля записи">
    {#if values.kind === 'event'}
      <EventForm bind:values {members} />
    {:else}
      <TaskForm bind:values {members} />
    {/if}

    <div class="composer-sheet__actions">
      <button class="button button--ghost" disabled={saving} type="button" on:click={() => closeComposer()}>
        Закрыть
      </button>
      <button class="button button--ghost" disabled={saving} type="button" on:click={discardDraft}>Удалить черновик</button>
      <button class="button button--primary" disabled={saving} type="submit">
        {saving ? 'Сохраняем' : 'Создать'}
      </button>
    </div>
    </fieldset>
  </form>
  </div>
</dialog>

<style>
  dialog.composer-sheet { margin: 0; top: auto; color: var(--color-text); }
  .composer-sheet__content { display: contents; }
  dialog.composer-sheet:not([open]) { display: none; }
  dialog.composer-sheet::backdrop { background: rgb(var(--color-shadow) / 0.18); backdrop-filter: blur(8px); }
  .composer-kind-controls, .composer-fields { border: 0; padding: 0; margin: 0; min-width: 0; }
  .composer-fields { display: grid; gap: 1rem; }
  .composer-sheet__actions { flex-wrap: wrap; }
  @media (min-width: 1024px) { dialog.composer-sheet { top: 2rem; } }
</style>

<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import ProfileAvatar from '$lib/components/media/ProfileAvatar.svelte';
  import { showItemDetails } from '$lib/stores/item-details.store';
  import type { AssignmentAction, AssignmentCardModel } from '$lib/assignments/assignments-view';

  export let card: AssignmentCardModel;
  export let busy = false;
  export let disabled = false;
  let returning = false;
  let reason = '';
  export let onaction:
    | ((action: AssignmentAction, card: AssignmentCardModel, reason?: string) => void | Promise<void>)
    | undefined = undefined;
</script>

<article class={`assignment-card assignment-card--${card.tone}`}>
  <span class="assignment-card__avatar" style:background={card.member ? 'transparent' : `var(--color-${card.memberTone}-soft)`} style:color={`var(--color-${card.memberTone})`} style:box-shadow={card.member ? 'none' : undefined} aria-hidden="true">
    {#if card.member}<ProfileAvatar member={card.member} size={48} />{:else}{card.assigneeInitial}{/if}
  </span>
  <div class="assignment-card__body">
    <div class="assignment-card__topline">
      <button class="work-detail-link" type="button" aria-label={`Открыть дело: ${card.title}`} on:click={() => showItemDetails(card.itemId, card.id)}>{card.title}</button>
      <span>{card.statusLabel}</span>
    </div>
    <p>{card.assigneeName} · {card.categoryLabel} · {card.dueLabel}</p>
    {#if card.rejectionReason}<p class="return-reason">{card.rejectionReason}</p>{/if}
    {#if card.primaryAction}
      <div class="assignment-card__actions">
        <button
          class="assignment-card__button assignment-card__button--primary"
          type="button"
          disabled={busy || disabled}
          aria-label={`${card.primaryLabel}: ${card.title}`}
          on:click={() => card.primaryAction && onaction?.(card.primaryAction, card)}
        >
          <Check size={16} strokeWidth={2.3} aria-hidden="true" />
          {busy ? 'Сохраняем' : card.primaryLabel}
        </button>
        {#if card.secondaryAction}
          <button
            class="assignment-card__button"
            type="button"
            disabled={busy || disabled}
            aria-expanded={returning}
            aria-label={`Вернуть: ${card.title}`}
            on:click={() => returning = !returning}
          >
            <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
            {card.secondaryLabel}
          </button>
        {/if}
      </div>
      {#if returning && card.secondaryAction}
        <form class="return-form" on:submit|preventDefault={() => onaction?.('reject_assignment', card, reason.trim() || undefined)}>
          <label>
            <span>Что нужно поправить</span>
            <textarea bind:value={reason} rows="2" maxlength="400" disabled={busy || disabled}></textarea>
          </label>
          <div>
            <button type="button" class="assignment-card__button" disabled={busy || disabled} on:click={() => returning = false}>Отмена</button>
            <button type="submit" class="assignment-card__button assignment-card__button--primary" disabled={busy || disabled}>Вернуть на доработку</button>
          </div>
        </form>
      {/if}
    {/if}
  </div>
</article>

<style>
  .work-detail-link { border: 0; padding: 4px 0; background: transparent; color: inherit; text-align: left; font: inherit; font-weight: 600; cursor: pointer; min-height: 44px; overflow-wrap: anywhere; }
  .work-detail-link:focus-visible { outline: 2px solid var(--color-green); outline-offset: 3px; }
  .assignment-card { min-width: 0; }
  .assignment-card__body { min-width: 0; flex: 1; }
  .assignment-card__topline { flex-wrap: wrap; gap: 8px; }
  p { overflow-wrap: anywhere; }
  .assignment-card__actions, .return-form > div { display: flex; flex-wrap: wrap; gap: 8px; }
  .assignment-card__button { min-height: 44px; }
  .assignment-card__button:focus-visible, textarea:focus-visible { outline: 2px solid var(--color-green); outline-offset: 3px; }
  .assignment-card__button:disabled { opacity: .55; cursor: default; }
  .return-form { display: grid; gap: 10px; margin-top: 12px; }
  .return-form label { display: grid; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
  textarea { width: 100%; box-sizing: border-box; resize: vertical; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); font: inherit; }
  .return-reason { padding-top: 8px; color: var(--color-text); }
</style>

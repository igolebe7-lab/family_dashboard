<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import type { AssignmentAction, AssignmentCardModel } from '$lib/assignments/assignments-view';

  export let card: AssignmentCardModel;
  export let busy = false;
  export let onaction:
    | ((action: AssignmentAction, card: AssignmentCardModel) => void | Promise<void>)
    | undefined = undefined;
</script>

<article class={`assignment-card assignment-card--${card.tone}`}>
  <span class="assignment-card__avatar" aria-hidden="true">{card.assigneeInitial}</span>
  <div class="assignment-card__body">
    <div class="assignment-card__topline">
      <strong>{card.title}</strong>
      <span>{card.statusLabel}</span>
    </div>
    <p>{card.assigneeName} · {card.categoryLabel} · {card.dueLabel}</p>
    {#if card.primaryAction}
      <div class="assignment-card__actions">
        <button
          class="assignment-card__button assignment-card__button--primary"
          type="button"
          disabled={busy}
          on:click={() => card.primaryAction && onaction?.(card.primaryAction, card)}
        >
          <Check size={16} strokeWidth={2.3} aria-hidden="true" />
          {busy ? 'Сохраняем' : card.primaryLabel}
        </button>
        {#if card.secondaryAction}
          <button
            class="assignment-card__button"
            type="button"
            disabled={busy}
            on:click={() => card.secondaryAction && onaction?.(card.secondaryAction, card)}
          >
            <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
            {card.secondaryLabel}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</article>

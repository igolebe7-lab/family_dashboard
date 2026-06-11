<script lang="ts">
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import MessageSquareText from '@lucide/svelte/icons/message-square-text';
  import SquareCheckBig from '@lucide/svelte/icons/square-check-big';
  import type { ComposerKind } from '$lib/composer/composer-form';

  export let value: ComposerKind = 'event';
  export let onchange: ((kind: ComposerKind) => void) | undefined = undefined;

  const tabs = [
    { kind: 'event' as const, label: 'Событие', icon: CalendarDays },
    { kind: 'task' as const, label: 'Дело', icon: SquareCheckBig },
    { kind: 'assignment' as const, label: 'Поручение', icon: MessageSquareText }
  ];
</script>

<div class="composer-tabs" role="tablist" aria-label="Тип записи">
  {#each tabs as tab (tab.kind)}
    <button
      class:composer-tabs__button--active={value === tab.kind}
      class="composer-tabs__button"
      type="button"
      role="tab"
      aria-selected={value === tab.kind}
      on:click={() => onchange?.(tab.kind)}
    >
      <svelte:component this={tab.icon} size={17} strokeWidth={2.25} aria-hidden="true" />
      {tab.label}
    </button>
  {/each}
</div>
